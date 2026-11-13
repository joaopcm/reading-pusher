import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { Book } from './library';
import { type RunDeps, runOnce } from './run';

const dune: Book = {
  id: 1,
  title: 'Duna',
  author: 'Frank Herbert',
  dir: '/b/1',
  files: [{ bookId: 1, path: '/b/1/d.mobi' }],
};

function deps(overrides: Partial<RunDeps> = {}): RunDeps {
  return {
    readLibrary: () => [dune],
    fingerprints: async () => new Map([['aaa', dune]]),
    fetchProgress: async () => [
      { fingerprint: 'aaa', percentage: 0.5, timestamp: 100 },
    ],
    prepareCover: async () => ({
      base64: 'x',
      version: 'v',
      spineColor: '#000000',
    }),
    write: mock(async () => 'written' as const),
    state: { lastProgressLog: null },
    ...overrides,
  };
}

describe('runOnce', () => {
  it('writes the newest book with its cover', async () => {
    const d = deps();
    await runOnce(d);
    expect(d.write).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Duna',
        percentage: 0.5,
        coverVersion: 'v',
      }),
      expect.objectContaining({ version: 'v', base64: 'x' }),
    );
  });

  it('reports success so the heartbeat only beats on good runs', async () => {
    expect(await runOnce(deps())).toBe(true);
  });

  it('keeps snapshot when kosync fails', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({
      fetchProgress: async () => {
        throw new Error('kosync answered 401 for aaa');
      },
    });
    expect(await runOnce(d)).toBe(false);
    expect(d.write).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0])).toContain('401');
    error.mockRestore();
  });

  it('clears when no book has progress', async () => {
    const d = deps({ fetchProgress: async () => [] });
    await runOnce(d);
    expect(d.write).toHaveBeenCalledWith(null, null);
  });

  it('logs the books with progress once per change', async () => {
    const info = spyOn(console, 'info').mockImplementation(() => {});
    const d = deps();
    await runOnce(d);
    await runOnce(d);
    const lines = info.mock.calls.filter((call) =>
      String(call[0]).includes('progress for'),
    );
    expect(lines).toHaveLength(1);
    expect(String(lines[0]?.[0])).toContain('Duna 50%');
    info.mockRestore();
  });
});
