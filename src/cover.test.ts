import { afterAll, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareCover } from './cover';

const dir = mkdtempSync(join(tmpdir(), 'cover-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function jpeg(
  name: string,
  width: number,
  height: number,
  leftRed = false,
) {
  const path = join(dir, name);
  const base = sharp({
    create: { width, height, channels: 3, background: '#0000ff' },
  });
  const composite = leftRed
    ? [
        {
          input: await sharp({
            create: { width: 40, height, channels: 3, background: '#ff0000' },
          })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ]
    : [];
  await base.composite(composite).jpeg({ quality: 100 }).toFile(path);
  return path;
}

describe('prepareCover', () => {
  it('resizes to 240px wide', async () => {
    const cover = await prepareCover(
      await jpeg('big.jpg', 1043, 1500),
      1_000_000,
    );
    const meta = await sharp(
      Buffer.from(cover?.base64 ?? '', 'base64'),
    ).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(240);
    expect(cover?.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('spine colour is the left edge mean', async () => {
    const cover = await prepareCover(
      await jpeg('edge.jpg', 480, 700, true),
      1_000_000,
    );
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(cover?.spineColor.slice(i, i + 2) ?? '', 16),
    );
    expect(r).toBeGreaterThan(240);
    expect(g).toBeLessThan(15);
    expect(b).toBeLessThan(15);
  });

  it('skips a cover over the limit', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    const path = await jpeg('limit.jpg', 300, 400);
    expect(await prepareCover(path, 1)).toBeNull();
    expect(String(error.mock.calls[0]?.[0])).toMatch(/limit 1 B.*limit\.jpg/);
    error.mockRestore();
  });

  it('returns null for a missing file', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    expect(await prepareCover(join(dir, 'nope.jpg'), 1_000_000)).toBeNull();
    error.mockRestore();
  });
});
