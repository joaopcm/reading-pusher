import type { PreparedCover } from './cover';
import type { Book } from './library';
import { type Progress, pickCurrent } from './progress';
import { buildSnapshot, type ReadingSnapshot } from './snapshot';

export type RunDeps = {
  readLibrary: () => Book[];
  fingerprints: (books: Book[]) => Promise<Map<string, Book>>;
  fetchProgress: (fingerprints: string[]) => Promise<Progress[]>;
  prepareCover: (path: string) => Promise<PreparedCover | null>;
  write: (
    snapshot: ReadingSnapshot | null,
    coverBase64: string | null,
  ) => Promise<'written' | 'unchanged' | 'cleared'>;
  state: { lastProgressLog: string | null };
};

function describeProgress(
  byFingerprint: Map<string, Book>,
  progress: Progress[],
) {
  const books = progress
    .map((entry) => {
      const book = byFingerprint.get(entry.fingerprint);
      return book
        ? `${book.title} ${Math.floor(entry.percentage * 100)}%`
        : null;
    })
    .filter(Boolean);
  return `[run] progress for ${books.length} book(s): ${books.join(', ') || 'none'}`;
}

export async function runOnce(deps: RunDeps): Promise<void> {
  try {
    const books = deps.readLibrary();
    const byFingerprint = await deps.fingerprints(books);
    const progress = await deps.fetchProgress([...byFingerprint.keys()]);

    const line = describeProgress(byFingerprint, progress);
    if (line !== deps.state.lastProgressLog) {
      console.info(line);
      deps.state.lastProgressLog = line;
    }

    const current = pickCurrent(byFingerprint, progress);
    if (!current) {
      await deps.write(null, null);
      return;
    }
    const cover = await deps.prepareCover(`${current.book.dir}/cover.jpg`);
    const result = await deps.write(
      buildSnapshot(current.book, current.progress, cover),
      cover?.base64 ?? null,
    );
    if (result !== 'unchanged')
      console.info(`[run] ${result}: ${current.book.title}`);
  } catch (error) {
    console.error('[run] failed, keeping the last snapshot:', error);
  }
}
