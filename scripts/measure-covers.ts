import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCover } from '../src/cover';

const root = process.argv[2] ?? '/books';
for (const author of readdirSync(root)) {
  const authorDir = join(root, author);
  if (!statSync(authorDir).isDirectory()) continue;
  for (const book of readdirSync(authorDir)) {
    const path = join(authorDir, book, 'cover.jpg');
    try {
      const original = statSync(path).size;
      const cover = await prepareCover(path, Number.POSITIVE_INFINITY);
      const resized = cover ? Buffer.from(cover.base64, 'base64').length : 0;
      console.info(`${resized}\t${original}\t${author}/${book}`);
    } catch {}
  }
}
