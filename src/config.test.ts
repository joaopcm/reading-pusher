import { describe, expect, it } from 'bun:test';
import { readConfig } from './config';

const base = {
  KV_REST_API_URL: 'https://x.upstash.io',
  KV_REST_API_TOKEN: 't',
  KOSYNC_USER: 'jopcmelo',
  KOSYNC_KEY: 'k',
};

describe('readConfig', () => {
  it('applies defaults', () => {
    expect(readConfig(base)).toEqual({
      upstashUrl: 'https://x.upstash.io',
      upstashToken: 't',
      libraryDir: '/books',
      kosyncUrl: 'http://kosync:17200',
      kosyncUser: 'jopcmelo',
      kosyncKey: 'k',
      intervalSeconds: 300,
    });
  });

  it('names the missing variable', () => {
    const { KOSYNC_KEY: _, ...missing } = base;
    expect(() => readConfig(missing)).toThrow('KOSYNC_KEY is required');
  });
});
