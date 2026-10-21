import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSession,
  deleteCookie,
  getCookie,
  parseCookies,
  serializeCookie,
  setCookie,
  toNodeHeaders,
} from '../src/runtime/cookies.ts';
import { withRequest } from '../src/runtime/request.ts';
import type { ResponseParts } from '../src/runtime/request.ts';
import { handleRoute } from '../src/runtime/server.ts';

const SECRET = 'a secret of more than thirty-two characters';

/** Runs code for a request with these cookies, and returns what it set. */
async function withCookies<T>(
  cookie: string,
  run: () => T | Promise<T>,
  url = 'https://example.com/',
): Promise<{ result: T; set: string[] }> {
  const response: ResponseParts = { headers: new Headers() };
  const request = new Request(url, { headers: cookie ? { cookie } : {} });
  const result = await withRequest(request, response, run);
  return { result, set: response.headers.getSetCookie() };
}

/** The `cookie` header that a browser sends back for `set-cookie` values. */
function cookieHeader(set: string[]): string {
  return set.map((value) => value.split(';')[0]).join('; ');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('cookies', () => {
  it('parses and writes headers', () => {
    expect(parseCookies('a=1; b=hello%20world; a=2')).toEqual({ a: '1', b: 'hello world' });
    expect(serializeCookie('theme', 'dark mode', { maxAge: 60, secure: true })).toBe(
      'theme=dark%20mode; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax',
    );
    expect(() => serializeCookie('bad name', 'x')).toThrow('not a valid cookie name');
  });

  it('reads the request, sets several cookies, and sees what it set', async () => {
    const { result, set } = await withCookies('theme=light', () => {
      const before = getCookie('theme');
      setCookie('theme', 'dark');
      setCookie('lang', 'fr', { httpOnly: false });
      deleteCookie('old');
      return [before, getCookie('theme'), getCookie('old')];
    });
    expect(result).toEqual(['light', 'dark', undefined]);
    expect(set).toEqual([
      'theme=dark; Path=/; HttpOnly; Secure; SameSite=Lax',
      'lang=fr; Path=/; Secure; SameSite=Lax',
      'old=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    ]);
  });

  it('keeps each cookie apart for Node', () => {
    const headers = new Headers({ 'content-type': 'text/html' });
    headers.append('set-cookie', 'a=1');
    headers.append('set-cookie', 'b=2');
    expect(toNodeHeaders(headers)).toEqual({
      'content-type': 'text/html',
      'set-cookie': ['a=1', 'b=2'],
    });
  });
});

describe('sessions', () => {
  const session = createSession<{ userId: string; theme?: string }>({ secret: SECRET });

  it('keeps data from one request to the next, and changes some of it', async () => {
    const first = await withCookies('', () => session.set({ userId: 'ada' }));
    const second = await withCookies(cookieHeader(first.set), async () => {
      const before = await session.get();
      const after = await session.update({ theme: 'dark' });
      return [before, after];
    });
    expect(second.result).toEqual([{ userId: 'ada' }, { userId: 'ada', theme: 'dark' }]);
    const third = await withCookies(cookieHeader(second.set), () => session.get());
    expect(third.result).toEqual({ userId: 'ada', theme: 'dark' });
  });

  it('refuses a cookie that the browser changed', async () => {
    const { set } = await withCookies('', () => session.set({ userId: 'ada' }));
    const [payload, signature] = cookieHeader(set).split('=')[1]!.split('.') as [string, string];
    const forged = btoa(JSON.stringify({ d: { userId: 'admin' }, e: Date.now() + 1000 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(payload).not.toBe(forged);
    const { result } = await withCookies(`session=${forged}.${signature}`, () => session.get());
    expect(result).toBeUndefined();
  });

  it('ends after its time, and when it is cleared', async () => {
    const short = createSession<{ id: number }>({ secret: SECRET, maxAge: 60 });
    const { set } = await withCookies('', () => short.set({ id: 1 }));
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    expect((await withCookies(cookieHeader(set), () => short.get())).result).toBeUndefined();
    vi.useRealTimers();
    const cleared = await withCookies(cookieHeader(set), async () => {
      short.clear();
      return short.get();
    });
    expect(cleared.result).toBeUndefined();
    expect(cleared.set[0]).toMatch(/^session=; Path=\/; Max-Age=0/);
  });

  it('reads a session that an older secret signed', async () => {
    const { set } = await withCookies('', () => session.set({ userId: 'ada' }));
    const rotated = createSession<{ userId: string }>({ secret: [`new ${SECRET}`, SECRET] });
    expect((await withCookies(cookieHeader(set), () => rotated.get())).result).toEqual({
      userId: 'ada',
    });
  });

  it('needs a long secret', () => {
    expect(() => createSession({ secret: 'short' })).toThrow('at least 32 characters');
  });
});

describe('cookies in routes', () => {
  it('adds the cookies that middleware sets to the answer', async () => {
    const answer = await handleRoute(
      {
        middleware: async () => ({
          middleware: async (_request, next) => {
            setCookie('seen', 'yes');
            return next();
          },
        }),
        endpoint: async () => ({
          GET: () => {
            setCookie('visits', '1');
            return Response.redirect('https://example.com/next', 303);
          },
        }),
      },
      new Request('https://example.com/'),
    );
    expect(answer?.status).toBe(303);
    expect(answer?.headers.getSetCookie()).toEqual([
      'seen=yes; Path=/; HttpOnly; Secure; SameSite=Lax',
      'visits=1; Path=/; HttpOnly; Secure; SameSite=Lax',
    ]);
  });
});
