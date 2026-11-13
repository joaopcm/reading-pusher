import { statSync } from 'node:fs';

const interval = Number(process.env.INTERVAL_SECONDS || 300) * 1000;
try {
  const age = Date.now() - statSync('/tmp/last-run').mtimeMs;
  process.exit(age < 2 * interval ? 0 : 1);
} catch {
  process.exit(1);
}
