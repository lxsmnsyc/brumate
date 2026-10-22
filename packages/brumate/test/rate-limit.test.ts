import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toJSON } from 'seroval';
import {
  RateLimitError,
  RequestEvent,
  clientAddress,
  configureRateLimit,
  getEvent,
  handleRequest,
  handleRoute,
  rateLimit,
} from '../src/runtime/server.ts';
import type { RateLimitStore, RouteNode } from '../src/runtime/server.ts';
import { createMemoryStore, setRateLimitClock, windowMs } from '../src/runtime/rate-limit.ts';

let now = 1_000_000;
let restore: () => number;

beforeEach(() => {
  now = 1_000_000;
  restore = setRateLimitClock(() => now);
  configureRateLimit({ proxies: [], enabled: true, store: undefined });
});

afterEach(() => {
  setRateLimitClock(restore);
  configureRateLimit({ proxies: [], enabled: undefined, store: undefined });
});

function event(address?: string, headers: Record<string, string> = {}): RequestEvent {
  return new RequestEvent(new Request('http://localhost/sign-in', { headers }), { address });
}

describe('windows', () => {
  it('reads a length in milliseconds, seconds, minutes, hours and days', () => {
    expect(windowMs(500)).toBe(500);
    expect(windowMs('250ms')).toBe(250);
    expect(windowMs('10s')).toBe(10_000);
    expect(windowMs('1.5m')).toBe(90_000);
    expect(windowMs('2h')).toBe(7_200_000);
    expect(windowMs('1d')).toBe(86_400_000);
    expect(() => windowMs('soon' as never)).toThrow('The window "soon" is not a length');
  });
});

describe('rateLimit', () => {
  it('lets max calls through, then refuses with the seconds to wait', async () => {
    const limit = { max: 3, window: '10s', event: event('1.2.3.4') } as const;
    await rateLimit(limit);
    await rateLimit(limit);
    await rateLimit(limit);
    const error = await rateLimit(limit).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).status).toBe(429);
    // The window ends in 10 seconds, and then the three calls weigh out over the next one.
    expect((error as RateLimitError).retryAfter).toBe(14);
    expect(limit.event.headers.get('retry-after')).toBe('14');
    expect((error as Error).message).toBe('Too many requests. Try again in 14 seconds');
  });

  it('slides the window, so a burst at the edge of a window does not get through', async () => {
    const limit = { max: 4, window: '10s' } as const;
    const caller = event('1.2.3.4');
    // Four calls late in the first window.
    now = 1_008_000;
    for (let i = 0; i < 4; i++) {
      // oxlint-disable-next-line no-await-in-loop -- Calls come one after the other.
      await rateLimit({ ...limit, event: caller });
    }
    // Early in the next window, the last one still weighs nearly in full.
    now = 1_011_000;
    await expect(rateLimit({ ...limit, event: caller })).rejects.toThrow(RateLimitError);
    // Half way through, half of the last window counts: two more calls fit, a third does not.
    now = 1_015_000;
    await rateLimit({ ...limit, event: caller });
    await rateLimit({ ...limit, event: caller });
    await expect(rateLimit({ ...limit, event: caller })).rejects.toThrow(RateLimitError);
    // A window later, the count is gone.
    now = 1_030_000;
    await rateLimit({ ...limit, event: caller });
  });

  it('counts each address, and each function, on its own', async () => {
    const limit = { max: 1, window: '1m' } as const;
    await rateLimit({ ...limit, event: event('1.2.3.4') });
    await rateLimit({ ...limit, event: event('5.6.7.8') });
    await expect(rateLimit({ ...limit, event: event('1.2.3.4') })).rejects.toThrow(RateLimitError);
    const other = event('1.2.3.4');
    other.call = { id: 'other#fn', args: [] };
    await rateLimit({ ...limit, event: other });
  });

  it('counts by a key of the app, such as the user', async () => {
    const limit = {
      max: 1,
      window: '1m' as const,
      key: (target: RequestEvent) => target.request.headers.get('x-user') ?? undefined,
    };
    await rateLimit({ ...limit, event: event('1.2.3.4', { 'x-user': 'ada' }) });
    await expect(
      rateLimit({ ...limit, event: event('5.6.7.8', { 'x-user': 'ada' }) }),
    ).rejects.toThrow(RateLimitError);
    await rateLimit({ ...limit, event: event('5.6.7.8', { 'x-user': 'grace' }) });
  });

  it('warns once and counts every caller without an address together', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limit = { max: 1, window: '1m' } as const;
      await rateLimit({ ...limit, event: event() });
      await expect(rateLimit({ ...limit, event: event() })).rejects.toThrow(RateLimitError);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('the address of the client is unknown');
    } finally {
      warn.mockRestore();
    }
  });

  it('counts nothing when it is off, as it is outside production', async () => {
    const limit = { max: 1, window: '1m', event: event('1.2.3.4') } as const;
    await rateLimit({ ...limit, enabled: false });
    await rateLimit({ ...limit, enabled: false });
    configureRateLimit({ enabled: undefined });
    // NODE_ENV is `test` here.
    await rateLimit(limit);
    await expect(rateLimit(limit)).resolves.toBeUndefined();
  });

  it('keeps its counts in the store of the options, or of the configuration', async () => {
    const calls: string[] = [];
    const store: RateLimitStore = {
      increment: (key) => {
        calls.push(key);
        return 1;
      },
      get: () => undefined,
    };
    await rateLimit({ max: 1, window: '1m', event: event('1.2.3.4'), store });
    configureRateLimit({ store });
    await rateLimit({ max: 1, window: '1m', event: event('1.2.3.4') });
    expect(calls).toEqual(['1.2.3.4 /sign-in 16', '1.2.3.4 /sign-in 16']);
  });

  it('has a strict preset for sign-ins', () => {
    expect(rateLimit.strict).toEqual({ max: 3, window: '10s' });
  });
});

describe('the memory store', () => {
  it('counts until a key expires', () => {
    const store = createMemoryStore(() => now);
    expect(store.increment('a', 1000)).toBe(1);
    expect(store.increment('a', 1000)).toBe(2);
    expect(store.get('a')).toBe(2);
    now += 1000;
    expect(store.get('a')).toBeUndefined();
    expect(store.increment('a', 1000)).toBe(1);
  });
});

describe('clientAddress', () => {
  it('is the address that the server saw', () => {
    expect(clientAddress(event('1.2.3.4', { 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4');
    expect(clientAddress(event('::ffff:1.2.3.4'))).toBe('1.2.3.4');
  });

  it('is unknown without one, whatever the headers say', () => {
    expect(clientAddress(event(undefined, { 'x-forwarded-for': '9.9.9.9' }))).toBeUndefined();
  });

  it('reads X-Forwarded-For from the right, past the trusted proxies', () => {
    const proxies = ['10.0.0.0/8', '192.168.1.1'];
    const headers = { 'x-forwarded-for': '6.6.6.6, 9.9.9.9, 10.1.2.3, 192.168.1.1' };
    expect(clientAddress(event('10.0.0.1', headers), proxies)).toBe('9.9.9.9');
    // A server that is not a proxy itself is the address, even with the header.
    expect(clientAddress(event('5.5.5.5', headers), proxies)).toBe('5.5.5.5');
    // Every hop a proxy: the address of the server, which is one too.
    expect(clientAddress(event('10.0.0.1', { 'x-forwarded-for': '10.9.9.9' }), proxies)).toBe(
      '10.0.0.1',
    );
    // Without a known address, the header is still trusted when proxies are named.
    expect(clientAddress(event(undefined, headers), proxies)).toBe('9.9.9.9');
    configureRateLimit({ proxies });
    expect(clientAddress(event('10.0.0.1', headers))).toBe('9.9.9.9');
  });

  it('counts an IPv6 address by its /64, and matches IPv6 ranges', () => {
    expect(clientAddress(event('2001:db8:85a3:1234:8a2e:370:7334:1'))).toBe(
      '2001:db8:85a3:1234:0:0:0:0',
    );
    expect(clientAddress(event('[2001:db8::1]'))).toBe('2001:db8:0:0:0:0:0:0');
    expect(
      clientAddress(event('fd00::1', { 'x-forwarded-for': '2001:db8::7' }), ['fd00::/8']),
    ).toBe('2001:db8:0:0:0:0:0:0');
    expect(clientAddress(event('not an address'))).toBeUndefined();
  });
});

describe('in requests', () => {
  it('refuses a call over the limit with 429, Retry-After and the message', async () => {
    const functions = {
      signIn: async () => {
        await rateLimit({ max: 1, window: '30s' });
        return 'ok';
      },
    };
    const call = (): Promise<Response | undefined> =>
      handleRequest(
        functions,
        new Request('http://localhost/_brumate/signIn', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(toJSON([])),
        }),
        '/_brumate',
        { address: '1.2.3.4' },
      );
    expect((await call())?.status).toBe(200);
    const refused = await call();
    expect(refused?.status).toBe(429);
    // The rest of this window, and the whole next one, which the call weighs on in full at first.
    expect(refused?.headers.get('retry-after')).toBe('50');
    expect(await refused!.json()).toEqual({ error: 'Too many requests. Try again in 50 seconds' });
  });

  it('limits every request under a folder, or of the entry, as middleware', async () => {
    const tree: RouteNode = {
      middleware: () =>
        Promise.resolve({ middleware: rateLimit.middleware({ max: 1, window: '1m' }) }),
      endpoint: () => Promise.resolve({ GET: () => new Response('hi') }),
    };
    const get = (options = {}): Promise<Response | undefined> =>
      handleRoute(tree, new Request('http://localhost/'), { address: '1.2.3.4', ...options });
    expect((await get())?.status).toBe(200);
    const refused = await get();
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get('retry-after')).toBe('80');
    expect(await refused!.text()).toBe('Too many requests. Try again in 80 seconds');

    // The same middleware guards the entry, with the event.
    const entry = rateLimit.middleware({ max: 1, window: '1m' });
    const other = (): Promise<Response | undefined> =>
      handleRoute(
        { endpoint: () => Promise.resolve({ GET: () => new Response('hi') }) },
        new Request('http://localhost/'),
        { address: '5.6.7.8', middleware: entry },
      );
    expect((await other())?.status).toBe(200);
    expect((await other())?.status).toBe(429);
  });

  it('reads the event itself, so the function needs no variable', async () => {
    const functions = {
      search: async () => {
        await rateLimit({
          max: 1,
          window: '1m' as const,
          key: () => getEvent().request.headers.get('x-user') ?? undefined,
        });
        return 'found';
      },
    };
    const call = (user: string): Promise<Response | undefined> =>
      handleRequest(
        functions,
        new Request('http://localhost/_brumate/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-user': user },
          body: JSON.stringify(toJSON([])),
        }),
      );
    expect((await call('ada'))?.status).toBe(200);
    expect((await call('ada'))?.status).toBe(429);
    expect((await call('grace'))?.status).toBe(200);
  });
});
