export const COVER_MAX_BYTES = 90_000;

export type Config = {
  upstashUrl: string;
  upstashToken: string;
  libraryDir: string;
  kosyncUrl: string;
  kosyncUser: string;
  kosyncKey: string;
  intervalSeconds: number;
};

type Env = Record<string, string | undefined>;

function required(env: Env, name: string) {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function readConfig(env: Env): Config {
  return {
    upstashUrl: required(env, 'KV_REST_API_URL'),
    upstashToken: required(env, 'KV_REST_API_TOKEN'),
    libraryDir: env.CALIBRE_LIBRARY || '/books',
    kosyncUrl: env.KOSYNC_URL || 'http://kosync:17200',
    kosyncUser: required(env, 'KOSYNC_USER'),
    kosyncKey: required(env, 'KOSYNC_KEY'),
    intervalSeconds: Number(env.INTERVAL_SECONDS || 300),
  };
}
