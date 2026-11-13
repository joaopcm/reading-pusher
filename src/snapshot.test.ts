import { describe, expect, it, mock } from 'bun:test';
import type { Book } from './library';
import { buildSnapshot, SnapshotWriter } from './snapshot';

const book: Book = {
  id: 1,
  title: 'Duna',
  author: 'Frank Herbert',
  dir: '/b/1',
  files: [],
};
const progress = {
  fingerprint: 'aaa',
  percentage: 0.7928,
  timestamp: 1794607105,
};

function fakeRedis() {
  return { set: mock(async () => 'OK'), del: mock(async () => 1) };
}

describe('buildSnapshot', () => {
  it('maps book, progress and cover', () => {
    expect(
      buildSnapshot(book, progress, {
        base64: 'x',
        version: 'abcdefabcdef',
        spineColor: '#112233',
      }),
    ).toEqual({
      title: 'Duna',
      author: 'Frank Herbert',
      percentage: 0.7928,
      lastReadAt: new Date(1794607105 * 1000).toISOString(),
      coverVersion: 'abcdefabcdef',
      spineColor: '#112233',
    });
  });

  it('writes without cover', () => {
    const snapshot = buildSnapshot(book, progress, null);
    expect(snapshot.coverVersion).toBeNull();
    expect(snapshot.spineColor).toBeNull();
  });
});

describe('SnapshotWriter', () => {
  const cover = { base64: 'x', version: 'v', spineColor: '#000000' };
  const snapshot = buildSnapshot(book, progress, cover);

  it('writes once, then unchanged', async () => {
    const redis = fakeRedis();
    const writer = new SnapshotWriter(redis);
    expect(await writer.write(snapshot, cover)).toBe('written');
    expect(redis.set).toHaveBeenCalledWith('reading:current', snapshot);
    expect(redis.set).toHaveBeenCalledWith('reading:cover', {
      version: 'v',
      base64: 'x',
    });
    expect(await writer.write(snapshot, cover)).toBe('unchanged');
    expect(redis.set).toHaveBeenCalledTimes(2);
  });

  it('clears both keys on null', async () => {
    const redis = fakeRedis();
    const writer = new SnapshotWriter(redis);
    expect(await writer.write(null, null)).toBe('cleared');
    expect(redis.del).toHaveBeenCalledWith('reading:current', 'reading:cover');
  });

  it('writes without cover and deletes the cover key', async () => {
    const redis = fakeRedis();
    const writer = new SnapshotWriter(redis);
    const bare = buildSnapshot(book, progress, null);
    expect(await writer.write(bare, null)).toBe('written');
    expect(redis.set).toHaveBeenCalledWith('reading:current', bare);
    expect(redis.del).toHaveBeenCalledWith('reading:cover');
  });

  it('retries after a failed write', async () => {
    const redis = fakeRedis();
    redis.set.mockImplementationOnce(async () => {
      throw new Error('upstash down');
    });
    const writer = new SnapshotWriter(redis);
    expect(writer.write(snapshot, cover)).rejects.toThrow('upstash down');
    expect(await writer.write(snapshot, cover)).toBe('written');
  });
});
