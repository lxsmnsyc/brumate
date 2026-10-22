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
  configureRateLimit({ proxies: [], enabled: undefined, store: undefined });
});

afterEach(() => {
  setRateLimitClock(restore);
  configureRateLimit({ proxies: [], enabled: undefined, store: undefined });
  vi.unstubAllEnvs();
});

function event(address?: string, headers: Record<string, string> = {}): RequestEvent {
  return new RequestEvent(new Request('http://localhost/sign-in', { headers }), { address });
}

function call(
  functions: Record<string, (...args: never[]) => unknown>,
  id: string,
  args: unknown[],
  options: { address?: string; headers?: Record<string, string> } = {},
): Promise<Response | undefined> {
  return handleRequest(
    functions as Record<string, (...args: unknown[]) => unknown>,
    new Request(`http://localhost/_brumate/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify(toJSON(args)),
    }),
    '/_brumate',
    { address: options.address },
  );
}

/** An endpoint that answers GET. */
function endpoint(): Promise<{ GET: () => Response }> {
  return Promise.resolve({ GET: () => new Response('hi') });
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
    // The window ends in 10 seconds, and then the four calls weigh out over half of the next one.
    expect((error as RateLimitError).retryAfter).toBe(15);
    expect(limit.event.headers.get('retry-after')).toBe('15');
    expect((error as Error).message).toBe('Too many requests. Try again in 15 seconds');
  });

  it('admits exactly max of the calls that arrive at the same time', async () => {
    // A store that answers later, as one over the network does.
    const memory = createMemoryStore(() => now);
    const store: RateLimitStore = {
      increment: async (key, ttl) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
        return memory.increment(key, ttl);
      },
      get: async (key) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
        return memory.get(key);
      },
    };
    const caller = event('1.2.3.4');
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => rateLimit({ max: 5, window: '1m', event: caller, store })),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    // The same with the memory store of the configuration.
    const others = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        rateLimit({ max: 5, window: '1m', event: event('5.6.7.8') }),
      ),
    );
    expect(others.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
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
    // Half way through, half of the last window counts, and the refused call counts too: one
    // more call fits, and the next does not.
    now = 1_015_000;
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

  it('counts by a key of the app, such as the user, and by the address without one', async () => {
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
    // Without a user, the address counts.
    await rateLimit({ ...limit, event: event('5.6.7.8') });
    await expect(rateLimit({ ...limit, event: event('5.6.7.8') })).rejects.toThrow(RateLimitError);
  });

  it('throws in production without a key or an address, rather than counting callers together', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const caller = event();
    caller.call = { id: 'auth#signIn', args: [] };
    await expect(rateLimit({ max: 1, window: '1m', event: caller })).rejects.toThrow(
      'rateLimit: the request to "auth#signIn" has no key, because the server did not pass the address of the client. Pass `address` to the handler of the server, or set `key` on the limit.',
    );
    // A key of the app needs no address.
    await rateLimit({ max: 1, window: '1m', event: caller, key: () => 'ada' });
  });

  it('warns once in development without a key or an address, and does not count', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limit = { max: 1, window: '1m' } as const;
      await rateLimit({ ...limit, event: event() });
      await rateLimit({ ...limit, event: event() });
      await rateLimit({ ...limit, event: event() });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('has no key');
    } finally {
      warn.mockRestore();
    }
  });

  it('counts by default, and nothing when it is off', async () => {
    const limit = { max: 1, window: '1m', event: event('1.2.3.4') } as const;
    await rateLimit({ ...limit, enabled: false });
    await rateLimit({ ...limit, enabled: false });
    configureRateLimit({ enabled: false });
    await rateLimit(limit);
    await rateLimit(limit);
    configureRateLimit({ enabled: undefined });
    // On by default, whatever NODE_ENV says, or when a runtime has none.
    vi.stubEnv('NODE_ENV', undefined);
    await rateLimit(limit);
    await expect(rateLimit(limit)).rejects.toThrow(RateLimitError);
  });

  it('does not count while the build prerenders', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const prerendered = new RequestEvent(new Request('http://localhost/'), { prerender: true });
    for (let i = 0; i < 5; i++) {
      // oxlint-disable-next-line no-await-in-loop -- Pages render one by one.
      await expect(
        rateLimit({ max: 1, window: '1m', event: prerendered }),
      ).resolves.toBeUndefined();
    }
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
    expect(calls).toEqual(['1.2.3.4 (no route) 16', '1.2.3.4 (no route) 16']);
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

  it('is unknown without one, whatever the headers say, even with proxies', () => {
    expect(clientAddress(event(undefined, { 'x-forwarded-for': '9.9.9.9' }))).toBeUndefined();
    expect(
      clientAddress(event(undefined, { 'x-forwarded-for': '9.9.9.9' }), ['10.0.0.0/8']),
    ).toBeUndefined();
  });

  it('reads X-Forwarded-For from the right, past the trusted proxies', () => {
    const proxies = ['10.0.0.0/8', '192.168.1.1'];
    const headers = { 'x-forwarded-for': '6.6.6.6, 9.9.9.9, 10.1.2.3, 192.168.1.1' };
    expect(clientAddress(event('10.0.0.1', headers), proxies)).toBe('9.9.9.9');
    // A peer that is not a proxy is the address, and the header is ignored.
    expect(clientAddress(event('5.5.5.5', headers), proxies)).toBe('5.5.5.5');
    // Every hop a proxy: the first of them.
    expect(clientAddress(event('10.0.0.1', { 'x-forwarded-for': '10.9.9.9' }), proxies)).toBe(
      '10.9.9.9',
    );
    // A proxy that sent no header is the client itself.
    expect(clientAddress(event('10.0.0.1'), proxies)).toBe('10.0.0.1');
    // A hop that is not an address stops the walk, before what the client wrote.
    expect(
      clientAddress(event('10.0.0.1', { 'x-forwarded-for': '6.6.6.6, unknown' }), proxies),
    ).toBeUndefined();
    configureRateLimit({ proxies });
    expect(clientAddress(event('10.0.0.1', headers))).toBe('9.9.9.9');
  });

  it('refuses a malformed range, rather than trusting every address', () => {
    for (const range of ['10.0.0.0/', '10.0.0.0/abc', '10.0.0.0/33', 'fd00::/129', '10.0.0/8']) {
      expect(() => configureRateLimit({ proxies: [range] })).toThrow(
        `The proxy range "${range}" is not an address`,
      );
      expect(() => clientAddress(event('10.0.0.1'), [range])).toThrow(TypeError);
    }
    expect(() => configureRateLimit({ proxies: ['10.0.0.0/0', '::1', 'fd00::/8'] })).not.toThrow();
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
    expect((await call(functions, 'signIn', [], { address: '1.2.3.4' }))?.status).toBe(200);
    const refused = await call(functions, 'signIn', [], { address: '1.2.3.4' });
    expect(refused?.status).toBe(429);
    // The rest of this window, and the whole next one, which the calls weigh on in full at first.
    expect(refused?.headers.get('retry-after')).toBe('50');
    expect(await refused!.json()).toEqual({ error: 'Too many requests. Try again in 50 seconds' });
  });

  it('counts by an argument of the call, such as the email of a sign-in', async () => {
    const functions = {
      signIn: async (email: string, _password: string) => {
        await rateLimit({ max: 1, window: '1m', key: () => email.toLowerCase() });
        return 'ok';
      },
      // The arguments reach the key too, as they do in middleware.
      reset: async () => {
        await rateLimit({ max: 1, window: '1m', key: (_event, [email]) => String(email) });
        return 'ok';
      },
    };
    expect((await call(functions, 'signIn', ['ada@example.com', 'a']))?.status).toBe(200);
    // Another address guesses at the same account.
    expect(
      (await call(functions, 'signIn', ['Ada@example.com', 'b'], { address: '5.6.7.8' }))?.status,
    ).toBe(429);
    expect((await call(functions, 'signIn', ['grace@example.com', 'a']))?.status).toBe(200);
    expect((await call(functions, 'reset', ['ada@example.com']))?.status).toBe(200);
    expect((await call(functions, 'reset', ['ada@example.com']))?.status).toBe(429);
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

  it('counts the paths of one route together, by its pattern', async () => {
    const tree: RouteNode = {
      middleware: () =>
        Promise.resolve({ middleware: rateLimit.middleware({ max: 1, window: '1m' }) }),
      static: {
        api: {
          dynamic: { name: 'id', node: { endpoint } },
          static: { list: { endpoint } },
        },
      },
    };
    const get = (path: string): Promise<Response | undefined> =>
      handleRoute(tree, new Request(`http://localhost${path}`), { address: '1.2.3.4' });
    expect((await get('/api/1'))?.status).toBe(200);
    expect((await get('/api/2'))?.status).toBe(429);
    // Another route counts on its own.
    expect((await get('/api/list'))?.status).toBe(200);
    // Paths that no route matches share one count.
    expect((await get('/nothing/1'))?.status).toBe(404);
    expect((await get('/nothing/2'))?.status).toBe(429);
  });

  it('exposes the pattern of the route on the event', async () => {
    let route: string | undefined;
    const tree: RouteNode = {
      static: {
        todos: {
          dynamic: {
            name: 'id',
            node: {
              endpoint: () =>
                Promise.resolve({
                  GET: () => {
                    route = getEvent().route;
                    return new Response('hi');
                  },
                }),
            },
          },
        },
      },
    };
    await handleRoute(tree, new Request('http://localhost/todos/3'));
    expect(route).toBe('/todos/[id]');
  });

  it('does not count while the build prerenders, without an address', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const tree: RouteNode = {
      middleware: () =>
        Promise.resolve({ middleware: rateLimit.middleware({ max: 1, window: '1m' }) }),
      endpoint: () => Promise.resolve({ GET: () => new Response('hi') }),
    };
    for (let i = 0; i < 3; i++) {
      // oxlint-disable-next-line no-await-in-loop -- Pages render one by one.
      const answer = await handleRoute(tree, new Request('http://localhost/'), { prerender: true });
      expect(answer?.status).toBe(200);
    }
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
    const search = (user: string): Promise<Response | undefined> =>
      call(functions, 'search', [], { headers: { 'x-user': user } });
    expect((await search('ada'))?.status).toBe(200);
    expect((await search('ada'))?.status).toBe(429);
    expect((await search('grace'))?.status).toBe(200);
  });
});
