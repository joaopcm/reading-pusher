import type { Book } from './library';

export type Progress = {
  fingerprint: string;
  percentage: number;
  timestamp: number;
};

type ProgressOptions = {
  baseUrl: string;
  user: string;
  key: string;
  fetch?: typeof fetch;
};

type ProgressBody = { percentage?: number; timestamp?: number };

export async function fetchProgress(
  fingerprints: string[],
  { baseUrl, user, key, fetch = globalThis.fetch }: ProgressOptions,
): Promise<Progress[]> {
  const found: Progress[] = [];
  for (const fingerprint of fingerprints) {
    const response = await fetch(`${baseUrl}/syncs/progress/${fingerprint}`, {
      headers: {
        Accept: 'application/vnd.koreader.v1+json',
        'x-auth-user': user,
        'x-auth-key': key,
      },
    });
    if (!response.ok) {
      throw new Error(
        `kosync answered ${response.status} for ${fingerprint}. If it's 401, KOSYNC_USER or KOSYNC_KEY is wrong.`,
      );
    }
    const body = (await response.json()) as ProgressBody;
    if (
      typeof body.percentage !== 'number' ||
      typeof body.timestamp !== 'number'
    ) {
      continue;
    }
    found.push({
      fingerprint,
      percentage: body.percentage,
      timestamp: body.timestamp,
    });
  }
  return found;
}

export function pickCurrent(
  byFingerprint: Map<string, Book>,
  progress: Progress[],
): { book: Book; progress: Progress } | null {
  let current: { book: Book; progress: Progress } | null = null;
  for (const entry of progress) {
    const book = byFingerprint.get(entry.fingerprint);
    if (!book) continue;
    const newer =
      !current ||
      entry.timestamp > current.progress.timestamp ||
      (entry.timestamp === current.progress.timestamp &&
        entry.percentage > current.progress.percentage);
    if (newer) current = { book, progress: entry };
  }
  return current;
}
