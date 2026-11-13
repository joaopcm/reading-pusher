import { describe, expect, it } from 'bun:test';
import type { Book } from './library';
import { fetchProgress, pickCurrent } from './progress';

const opts = { baseUrl: 'http://kosync:17200', user: 'jopcmelo', key: 'abc' };

function stubFetch(
  responses: Record<string, { status?: number; body: unknown }>,
) {
  const calls: { url: string; headers: Headers }[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    const fingerprint = url.split('/').pop() ?? '';
    const response = responses[fingerprint] ?? { body: {} };
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const book = (id: number): Book => ({
  id,
  title: `book ${id}`,
  author: 'a',
  dir: `/b/${id}`,
  files: [],
});

describe('fetchProgress', () => {
  it('sends kosync auth headers', async () => {
    const { fetch, calls } = stubFetch({});
    await fetchProgress(['aaa'], { ...opts, fetch });
    expect(calls[0]?.url).toBe('http://kosync:17200/syncs/progress/aaa');
    expect(calls[0]?.headers.get('accept')).toBe(
      'application/vnd.koreader.v1+json',
    );
    expect(calls[0]?.headers.get('x-auth-user')).toBe('jopcmelo');
    expect(calls[0]?.headers.get('x-auth-key')).toBe('abc');
  });

  it('drops books without progress', async () => {
    const { fetch } = stubFetch({
      aaa: { body: { document: 'aaa', percentage: 0.5, timestamp: 100 } },
      bbb: { body: {} },
    });
    expect(await fetchProgress(['aaa', 'bbb'], { ...opts, fetch })).toEqual([
      { fingerprint: 'aaa', percentage: 0.5, timestamp: 100 },
    ]);
  });

  it('throws on 401 naming the fingerprint', async () => {
    const { fetch } = stubFetch({
      aaa: { status: 401, body: { message: 'Unauthorized' } },
    });
    expect(fetchProgress(['aaa'], { ...opts, fetch })).rejects.toThrow(
      /401.*aaa/,
    );
  });
});

describe('pickCurrent', () => {
  it('picks the newest across books', () => {
    const books = new Map([
      ['aaa', book(1)],
      ['bbb', book(2)],
    ]);
    const picked = pickCurrent(books, [
      { fingerprint: 'aaa', percentage: 0.9, timestamp: 100 },
      { fingerprint: 'bbb', percentage: 0.1, timestamp: 200 },
    ]);
    expect(picked?.book.id).toBe(2);
  });

  it('checks every format', () => {
    const dune = book(1);
    const books = new Map([
      ['mobi', dune],
      ['epub', dune],
      ['other', book(2)],
    ]);
    const picked = pickCurrent(books, [
      { fingerprint: 'epub', percentage: 0.3, timestamp: 50 },
    ]);
    expect(picked).toEqual({
      book: dune,
      progress: { fingerprint: 'epub', percentage: 0.3, timestamp: 50 },
    });
  });

  it('returns null without progress', () => {
    expect(pickCurrent(new Map([['aaa', book(1)]]), [])).toBeNull();
  });
});
