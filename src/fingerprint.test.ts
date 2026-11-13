import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { partialMd5 } from './fingerprint';

const dir = mkdtempSync(join(tmpdir(), 'fingerprint-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function fixture(name: string, size: number) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 7 + 3) % 256;
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

describe('partialMd5', () => {
  it('matches KOReader on a 5 MB file', async () => {
    expect(await partialMd5(fixture('big.bin', 5_000_000))).toBe(
      'e7d9befc38280c62a9fa40eae7633c90',
    );
  });

  it('handles a file shorter than 1 KiB', async () => {
    expect(await partialMd5(fixture('small.bin', 600))).toBe(
      'ad65f7b480bbd7bdea9f3ff185e81209',
    );
  });
});
