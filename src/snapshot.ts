import { createHash } from 'node:crypto';
import type { PreparedCover } from './cover';
import type { Book } from './library';
import type { Progress } from './progress';

export type ReadingSnapshot = {
  title: string;
  author: string;
  percentage: number;
  lastReadAt: string;
  coverVersion: string | null;
  spineColor: string | null;
};

export const CURRENT_KEY = 'reading:current';
export const COVER_KEY = 'reading:cover';

export function buildSnapshot(
  book: Book,
  progress: Progress,
  cover: PreparedCover | null,
): ReadingSnapshot {
  return {
    title: book.title,
    author: book.author,
    percentage: progress.percentage,
    lastReadAt: new Date(progress.timestamp * 1000).toISOString(),
    coverVersion: cover?.version ?? null,
    spineColor: cover?.spineColor ?? null,
  };
}

type Store = {
  set: (key: string, value: unknown) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
};

export class SnapshotWriter {
  private lastWritten: string | null = null;

  constructor(private redis: Store) {}

  async write(
    snapshot: ReadingSnapshot | null,
    coverBase64: string | null,
  ): Promise<'written' | 'unchanged' | 'cleared'> {
    const digest = createHash('sha1')
      .update(JSON.stringify([snapshot, coverBase64]))
      .digest('hex');
    if (digest === this.lastWritten) return 'unchanged';
    if (!snapshot) {
      await this.redis.del(CURRENT_KEY, COVER_KEY);
      this.lastWritten = digest;
      return 'cleared';
    }
    if (coverBase64) {
      await this.redis.set(COVER_KEY, coverBase64);
    } else {
      await this.redis.del(COVER_KEY);
    }
    await this.redis.set(CURRENT_KEY, snapshot);
    this.lastWritten = digest;
    return 'written';
  }
}
