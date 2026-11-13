import { Database } from 'bun:sqlite';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { partialMd5 } from './fingerprint';

export type BookFile = { bookId: number; path: string };

export type Book = {
  id: number;
  title: string;
  author: string;
  dir: string;
  files: BookFile[];
};

const PRIVATE_TAG = 'private';

type BookRow = {
  id: number;
  title: string;
  path: string;
  author: string | null;
};
type FileRow = { book: number; format: string; name: string };

export function readLibrary(libraryDir: string): Book[] {
  const db = new Database(join(libraryDir, 'metadata.db'), { readonly: true });
  try {
    const rows = db
      .query<BookRow, [string]>(
        `SELECT b.id, b.title, b.path,
           (SELECT group_concat(name, ', ') FROM (
              SELECT a.name FROM books_authors_link l
              JOIN authors a ON a.id = l.author
              WHERE l.book = b.id ORDER BY l.id)) AS author
         FROM books b
         WHERE NOT EXISTS (
           SELECT 1 FROM books_tags_link bt JOIN tags t ON t.id = bt.tag
           WHERE bt.book = b.id AND lower(t.name) = ?)
         ORDER BY b.id`,
      )
      .all(PRIVATE_TAG);
    const files = db
      .query<FileRow, []>('SELECT book, format, name FROM data ORDER BY id')
      .all();
    return rows.map((row) => {
      const dir = join(libraryDir, row.path);
      return {
        id: row.id,
        title: row.title,
        author: row.author ?? '',
        dir,
        files: files
          .filter((file) => file.book === row.id)
          .map((file) => ({
            bookId: row.id,
            path: join(dir, `${file.name}.${file.format.toLowerCase()}`),
          })),
      };
    });
  } finally {
    db.close();
  }
}

type Cached = { size: number; mtimeMs: number; fingerprint: string };

export class FingerprintCache {
  private cache = new Map<string, Cached>();

  async fingerprints(books: Book[]): Promise<Map<string, Book>> {
    const byFingerprint = new Map<string, Book>();
    for (const book of books) {
      for (const file of book.files) {
        const fingerprint = await this.fingerprint(file.path);
        if (fingerprint) byFingerprint.set(fingerprint, book);
      }
    }
    return byFingerprint;
  }

  private async fingerprint(path: string): Promise<string | null> {
    let stats: { size: number; mtimeMs: number };
    try {
      stats = statSync(path);
    } catch {
      console.error(`[library] listed in Calibre but missing on disk: ${path}`);
      return null;
    }
    const cached = this.cache.get(path);
    if (
      cached &&
      cached.size === stats.size &&
      cached.mtimeMs === stats.mtimeMs
    ) {
      return cached.fingerprint;
    }
    const fingerprint = await partialMd5(path);
    this.cache.set(path, {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      fingerprint,
    });
    return fingerprint;
  }
}
