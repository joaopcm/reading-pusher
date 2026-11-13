import { createHash } from 'node:crypto';
import sharp from 'sharp';

const COVER_WIDTH = 240;
const SPINE_SAMPLE_WIDTH = 8;

export type PreparedCover = {
  base64: string;
  version: string;
  spineColor: string;
};

function hex(value: number) {
  return Math.round(value).toString(16).padStart(2, '0');
}

export async function prepareCover(
  path: string,
  maxBytes: number,
): Promise<PreparedCover | null> {
  let jpeg: Buffer;
  try {
    jpeg = await sharp(path)
      .resize({ width: COVER_WIDTH })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    console.error(`[cover] can't read ${path}:`, error);
    return null;
  }
  if (jpeg.length > maxBytes) {
    console.error(
      `[cover] skipped: limit ${maxBytes} B, resized cover is ${jpeg.length} B, ${path}. Raise COVER_MAX_BYTES if this is a normal cover.`,
    );
    return null;
  }
  const { height = 1 } = await sharp(jpeg).metadata();
  const spine = await sharp(jpeg)
    .extract({ left: 0, top: 0, width: SPINE_SAMPLE_WIDTH, height })
    .toBuffer();
  const { channels } = await sharp(spine).stats();
  const [r, g, b] = channels.map((channel) => channel.mean);
  return {
    base64: jpeg.toString('base64'),
    version: createHash('sha1').update(jpeg).digest('hex').slice(0, 12),
    spineColor: `#${hex(r ?? 0)}${hex(g ?? 0)}${hex(b ?? 0)}`,
  };
}
