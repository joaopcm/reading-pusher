const SAMPLE_BYTES = 1024;
const LAST_STEP = 10;

export async function partialMd5(path: string): Promise<string> {
  const file = Bun.file(path);
  const hasher = new Bun.CryptoHasher('md5');
  for (let step = -1; step <= LAST_STEP; step++) {
    const offset = step < 0 ? 0 : SAMPLE_BYTES << (2 * step);
    const sample = await file.slice(offset, offset + SAMPLE_BYTES).bytes();
    if (sample.length === 0) break;
    hasher.update(sample);
  }
  return hasher.digest('hex');
}
