import { Database } from 'bun:sqlite';
import { afterAll, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as fingerprint from './fingerprint';
import { FingerprintCache, readLibrary } from './library';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Seed = {
  id: number;
  title: string;
  path: string;
  authors: string[];
  tags?: string[];
  files: { format: string; name: string; content: string }[];
};

function library(books: Seed[]) {
  const root = mkdtempSync(join(tmpdir(), 'library-'));
  roots.push(root);
  const db = new Database(join(root, 'metadata.db'));
  db.run('CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, path TEXT)');
  db.run('CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT)');
  db.run(
    'CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER)',
  );
  db.run('CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)');
  db.run(
    'CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER)',
  );
  db.run(
    'CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT, name TEXT)',
  );
  let authorId = 0;
  let tagId = 0;
  for (const book of books) {
    db.run('INSERT INTO books VALUES (?, ?, ?)', [
      book.id,
      book.title,
      book.path,
    ]);
    for (const name of book.authors) {
      authorId++;
      db.run('INSERT INTO authors VALUES (?, ?)', [authorId, name]);
      db.run('INSERT INTO books_authors_link (book, author) VALUES (?, ?)', [
        book.id,
        authorId,
      ]);
    }
    for (const name of book.tags ?? []) {
      tagId++;
      db.run('INSERT INTO tags VALUES (?, ?)', [tagId, name]);
      db.run('INSERT INTO books_tags_link (book, tag) VALUES (?, ?)', [
        book.id,
        tagId,
      ]);
    }
    mkdirSync(join(root, book.path), { recursive: true });
    for (const file of book.files) {
      db.run('INSERT INTO data (book, format, name) VALUES (?, ?, ?)', [
        book.id,
        file.format,
        file.name,
      ]);
      writeFileSync(
        join(root, book.path, `${file.name}.${file.format.toLowerCase()}`),
        file.content,
      );
    }
  }
  db.close();
  return root;
}

const dune: Seed = {
  id: 1,
  title: 'Duna',
  path: 'Frank Herbert/Duna (1)',
  authors: ['Frank Herbert'],
  files: [
    { format: 'MOBI', name: 'Duna - Frank Herbert', content: 'mobi bytes' },
    { format: 'EPUB', name: 'Duna - Frank Herbert', content: 'epub bytes' },
  ],
};

describe('readLibrary', () => {
  it('lists books with every format', () => {
    const root = library([dune]);
    expect(readLibrary(root)).toEqual([
      {
        id: 1,
        title: 'Duna',
        author: 'Frank Herbert',
        dir: join(root, 'Frank Herbert/Duna (1)'),
        files: [
          {
            bookId: 1,
            path: join(
              root,
              'Frank Herbert/Duna (1)/Duna - Frank Herbert.mobi',
            ),
          },
          {
            bookId: 1,
            path: join(
              root,
              'Frank Herbert/Duna (1)/Duna - Frank Herbert.epub',
            ),
          },
        ],
      },
    ]);
  });

  it('skips private books', () => {
    const root = library([
      dune,
      {
        ...dune,
        id: 2,
        path: 'x/Secret (2)',
        title: 'Secret',
        tags: ['Private'],
      },
    ]);
    expect(readLibrary(root).map((book) => book.title)).toEqual(['Duna']);
  });

  it('joins authors in link order', () => {
    const root = library([
      { ...dune, authors: ['Neil Gaiman', 'Terry Pratchett'] },
    ]);
    expect(readLibrary(root)[0]?.author).toBe('Neil Gaiman, Terry Pratchett');
  });
});

describe('FingerprintCache', () => {
  it('re-hashes only changed files', async () => {
    const root = library([dune]);
    const books = readLibrary(root);
    const spy = spyOn(fingerprint, 'partialMd5');
    const cache = new FingerprintCache();

    const first = await cache.fingerprints(books);
    expect(first.size).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockClear();
    await cache.fingerprints(books);
    expect(spy).toHaveBeenCalledTimes(0);

    writeFileSync(books[0]?.files[0]?.path ?? '', 'new mobi bytes, longer');
    await cache.fingerprints(books);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
