import { Redis } from '@upstash/redis';
import { COVER_MAX_BYTES, readConfig } from './config';
import { prepareCover } from './cover';
import { FingerprintCache, readLibrary } from './library';
import { fetchProgress } from './progress';
import { runOnce } from './run';
import { SnapshotWriter } from './snapshot';

const HEARTBEAT_PATH = '/tmp/last-run';

const config = (() => {
  try {
    return readConfig(process.env);
  } catch (error) {
    console.error(`[config] ${(error as Error).message}`);
    process.exit(1);
  }
})();

const cache = new FingerprintCache();
const writer = new SnapshotWriter(
  new Redis({ url: config.upstashUrl, token: config.upstashToken }),
);
const state = { lastProgressLog: null };

async function tick() {
  const ok = await runOnce({
    readLibrary: () => readLibrary(config.libraryDir),
    fingerprints: (books) => cache.fingerprints(books),
    fetchProgress: (fingerprints) =>
      fetchProgress(fingerprints, {
        baseUrl: config.kosyncUrl,
        user: config.kosyncUser,
        key: config.kosyncKey,
      }),
    prepareCover: (path) => prepareCover(path, COVER_MAX_BYTES),
    write: (snapshot, cover) => writer.write(snapshot, cover),
    state,
  });
  if (ok) await Bun.write(HEARTBEAT_PATH, new Date().toISOString());
}

console.info(
  `[main] every ${config.intervalSeconds}s, library ${config.libraryDir}, kosync ${config.kosyncUrl}`,
);
await tick();
setInterval(tick, config.intervalSeconds * 1000);
