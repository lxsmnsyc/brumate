// Rate limits for server functions, endpoints and pages. A limit counts the
// requests of each key, such as the address of the client, in a sliding
// window, and answers 429 with `Retry-After` once a key has made too many.

import { RequestEvent, ServerError, getEvent } from './request.ts';
import type { Middleware } from './router.ts';

/**
 * Where a limit keeps its counts. The default counts in memory, per
 * process. An app with more than one server passes a store on Redis or a
 * platform store, whose `increment` is one atomic command, such as `INCR`
 * with `EXPIRE`.
 */
export interface RateLimitStore {
  /** Adds one to the count of a key, which expires after `ttl` milliseconds, and returns the new count. */
  increment(key: string, ttl: number): number | Promise<number>;
  /** The count of a key, or undefined when it has none or it expired. */
  get(key: string): number | undefined | Promise<number | undefined>;
}

/** A window as a number of milliseconds, or as text such as `'10s'`, `'1m'` or `'1h'`. */
export type Window = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

export interface RateLimitOptions {
  /** How many requests a key can make in the window. */
  max: number;
  /** The length of the window. */
  window: Window;
  /**
   * What to count by. Defaults to the address of the client and the ID of
   * the server function, or the path of the request, so each function has
   * its own count. A key from the session limits a user instead, wherever
   * they sign in from.
   */
  key?: (event: RequestEvent) => string | undefined | Promise<string | undefined>;
  /** The event of the request. Defaults to `getEvent()`. */
  event?: RequestEvent;
  /** The store of the counts. Defaults to the store of `configureRateLimit`, or memory. */
  store?: RateLimitStore;
  /** Whether the limit counts. Defaults to `configureRateLimit`, which is on in production only. */
  enabled?: boolean;
}

export interface RateLimitConfig {
  /** The store of every limit that names none. Defaults to memory, which counts per process. */
  store?: RateLimitStore;
  /**
   * The proxies in front of the server, as addresses or CIDR ranges, such
   * as `10.0.0.0/8`. `clientAddress` trusts `X-Forwarded-For` from them.
   */
  proxies?: string[];
  /**
   * Whether limits count. Defaults to true when `NODE_ENV` is
   * `production`, so a reload while working does not lock anyone out.
   */
  enabled?: boolean;
}

/**
 * The error of a request over its limit. Its status is 429, and
 * `retryAfter` is how many seconds to wait. In the browser, the call rejects
 * with it, and `retryAfter` comes from the `Retry-After` header.
 */
export class RateLimitError extends ServerError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `Too many requests. Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}`,
      {
        status: 429,
      },
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** The length of a window in milliseconds. */
export function windowMs(window: Window): number {
  if (typeof window === 'number') {
    return window;
  }
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(window);
  if (!match) {
    throw new TypeError(`The window "${window}" is not a length such as "10s", "1m" or "1h"`);
  }
  return Number(match[1]) * UNITS[match[2]!]!;
}

/** Counts in memory, per process. Expired keys go when they are read, and in a sweep now and then. */
export function createMemoryStore(now: () => number = Date.now): RateLimitStore {
  const counts = new Map<string, { count: number; expires: number }>();
  let sweeps = 0;
  const sweep = (): void => {
    if (++sweeps % 1000 !== 0) {
      return;
    }
    const time = now();
    for (const [key, entry] of counts) {
      if (entry.expires <= time) {
        counts.delete(key);
      }
    }
  };
  return {
    increment(key, ttl) {
      sweep();
      const time = now();
      const entry = counts.get(key);
      if (!entry || entry.expires <= time) {
        counts.set(key, { count: 1, expires: time + ttl });
        return 1;
      }
      entry.count++;
      return entry.count;
    },
    get(key) {
      const entry = counts.get(key);
      return entry && entry.expires > now() ? entry.count : undefined;
    },
  };
}

const config: RateLimitConfig = {};
let memory: RateLimitStore | undefined;
let warned = false;
/** The clock, which tests replace. */
let clock: () => number = Date.now;

/** Sets the defaults of every limit: the store, the trusted proxies, and whether limits count. */
export function configureRateLimit(options: RateLimitConfig): void {
  Object.assign(config, options);
}

/** Replaces the clock of the limits, for tests. Returns the clock from before. */
export function setRateLimitClock(now: () => number): () => number {
  const previous = clock;
  clock = now;
  memory = createMemoryStore(now);
  return previous;
}

function isEnabled(options: { enabled?: boolean }): boolean {
  if (options.enabled !== undefined) {
    return options.enabled;
  }
  if (config.enabled !== undefined) {
    return config.enabled;
  }
  const process = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return process?.env?.NODE_ENV === 'production';
}

/** The key of a request: the address of the client and the server function, or the path. */
function defaultKey(event: RequestEvent): string {
  let address = clientAddress(event);
  if (address === undefined) {
    if (!warned) {
      warned = true;
      console.warn(
        'rateLimit: the address of the client is unknown, so every request counts in one bucket. Pass `address` to the handler of the server, or name the proxies in front of it with configureRateLimit({ proxies })',
      );
    }
    address = 'unknown';
  }
  const target = event.call?.id ?? new URL(event.request.url).pathname;
  return `${address} ${target}`;
}

/**
 * Checks and counts a request. Throws a `RateLimitError` when its key has
 * made more than `max` requests in the window.
 */
async function check(event: RequestEvent, options: RateLimitOptions): Promise<void> {
  if (!isEnabled(options)) {
    return;
  }
  const key = (await options.key?.(event)) ?? defaultKey(event);
  const store = options.store ?? config.store ?? (memory ??= createMemoryStore(clock));
  const window = windowMs(options.window);
  const now = clock();
  const bucket = Math.floor(now / window);
  const elapsed = now - bucket * window;
  // Two counts per key, this window and the last. The last one weighs by how much of it is still
  // inside the sliding window, so a burst at the edge of a window does not get through. A request
  // over the limit is not counted, so a client that keeps trying does not wait longer for it.
  const [current = 0, previous = 0] = await Promise.all([
    store.get(`${key} ${bucket}`),
    store.get(`${key} ${bucket - 1}`),
  ]);
  const weight = 1 - elapsed / window;
  if (current + previous * weight + 1 <= options.max) {
    await store.increment(`${key} ${bucket}`, window * 2);
    return;
  }
  // When the next request passes: later in this window, once enough of the last one has left it,
  // or in the next window, once enough of this one has.
  const room = options.max - current - 1;
  const wait =
    room >= 0 && previous > 0
      ? window * (1 - room / previous) - elapsed
      : window -
        elapsed +
        (current > options.max - 1 ? window * (1 - (options.max - 1) / current) : 0);
  const retryAfter = Math.max(1, Math.ceil(wait / 1000));
  event.headers.set('retry-after', String(retryAfter));
  throw new RateLimitError(retryAfter);
}

/**
 * Limits how often a key, such as the address of the client, can call a
 * server function. Call it first thing in the function, before its first
 * `await`, as `getEvent()`:
 *
 * ```ts
 * async function signIn(name: string, password: string) {
 *   'use server';
 *   await rateLimit({ max: 5, window: '1m' });
 *   // …
 * }
 * ```
 *
 * The sixth call in a minute from one address rejects with a
 * `RateLimitError`, with status 429 and `Retry-After`, and the rest of the
 * function does not run. `rateLimit.middleware(options)` limits every
 * request under a folder of routes, or of the whole app from the entry.
 */
export const rateLimit: RateLimit = Object.assign(
  (options: RateLimitOptions): Promise<void> => {
    const event = options.event ?? getEvent();
    return check(event, options);
  },
  {
    middleware:
      (options: RateLimitOptions): RateLimitMiddleware =>
      async (target: Request | RequestEvent, next: () => Promise<Response>) => {
        const event = target instanceof RequestEvent ? target : (options.event ?? getEvent());
        try {
          await check(event, options);
        } catch (error) {
          if (error instanceof RateLimitError) {
            return new Response(error.message, {
              status: 429,
              headers: { 'retry-after': String(error.retryAfter), 'content-type': 'text/plain' },
            });
          }
          throw error;
        }
        return next();
      },
    strict: { max: 3, window: '10s' } satisfies RateLimitOptions,
  },
);

/** A middleware of a folder, `(request, next)`, or of the entry, `(event, next)`. */
export type RateLimitMiddleware = Middleware &
  ((event: RequestEvent, next: () => Promise<Response>) => Promise<Response>);

export interface RateLimit {
  (options: RateLimitOptions): Promise<void>;
  /**
   * A limit for every request that passes through a middleware, of a folder
   * or of the entry. A request over the limit answers 429 with `Retry-After`.
   */
  middleware: (options: RateLimitOptions) => RateLimitMiddleware;
  /** A limit for functions that guess at secrets, such as a sign-in or a code check: 3 calls in 10 seconds. */
  strict: RateLimitOptions;
}

// Addresses

/** The 16 bytes of an address, or undefined for text that is not one. */
function parseAddress(text: string): Uint8Array | undefined {
  const value = text.trim().replace(/^\[|\]$/g, '');
  if (value.includes(':')) {
    return parseIPv6(value);
  }
  const parts = value.split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) < 256)) {
    return undefined;
  }
  const bytes = new Uint8Array(16);
  bytes[10] = 0xff;
  bytes[11] = 0xff;
  parts.forEach((part, index) => {
    bytes[12 + index] = Number(part);
  });
  return bytes;
}

function parseIPv6(value: string): Uint8Array | undefined {
  // An IPv4 tail, such as `::ffff:1.2.3.4`, becomes two groups.
  const tail = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  let text = value;
  if (tail) {
    const v4 = parseAddress(tail[2]!);
    if (!v4) {
      return undefined;
    }
    text = `${tail[1]}${((v4[12]! << 8) | v4[13]!).toString(16)}:${((v4[14]! << 8) | v4[15]!).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return undefined;
  }
  const groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  const bytes = new Uint8Array(16);
  for (const [index, group] of groups.entries()) {
    if (!/^[\da-f]{1,4}$/i.test(group)) {
      return undefined;
    }
    const number = Number.parseInt(group, 16);
    bytes[index * 2] = number >> 8;
    bytes[index * 2 + 1] = number & 0xff;
  }
  return bytes;
}

function isIPv4(bytes: Uint8Array): boolean {
  return bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
}

/** True if an address is in a range: an address, or a CIDR such as `10.0.0.0/8` or `fd00::/8`. */
export function inRange(address: Uint8Array, range: string): boolean {
  const [text, length] = range.split('/');
  const base = parseAddress(text!);
  if (!base) {
    return false;
  }
  const v4 = isIPv4(base);
  if (v4 !== isIPv4(address)) {
    return false;
  }
  // Addresses are 16 bytes, with an IPv4 one in the last 4, so its prefix length moves by 96.
  const bits = length === undefined ? 128 : Number(length) + (v4 ? 96 : 0);
  for (let bit = 0; bit < bits; bit++) {
    const mask = 0x80 >> (bit % 8);
    if (((address[bit >> 3]! ^ base[bit >> 3]!) & mask) !== 0) {
      return false;
    }
  }
  return true;
}

/** The text of an address. An IPv6 address counts by its /64, since one client often holds a whole subnet. */
function formatAddress(bytes: Uint8Array): string {
  if (isIPv4(bytes)) {
    return bytes.slice(12).join('.');
  }
  const groups: string[] = [];
  for (let index = 0; index < 8; index++) {
    groups.push(index < 4 ? ((bytes[index * 2]! << 8) | bytes[index * 2 + 1]!).toString(16) : '0');
  }
  return groups.join(':');
}

/**
 * The address of the client of a request. It is the address that the server
 * saw, which the handler of the server passes as `address`. Behind the
 * proxies that `configureRateLimit({ proxies })` names, it comes from
 * `X-Forwarded-For`: the header is read from the right, past the trusted
 * proxies, because a client can write anything at its left. An IPv6
 * address counts by its /64. Undefined when no address is known.
 */
export function clientAddress(
  event: RequestEvent,
  proxies: string[] = config.proxies ?? [],
): string | undefined {
  const trusted = (address: Uint8Array): boolean =>
    proxies.some((range) => inRange(address, range));
  const seen = event.address === undefined ? undefined : parseAddress(event.address);
  const forwarded = (event.request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((item) => parseAddress(item))
    .filter((item): item is Uint8Array => item !== undefined);
  // Without a known address, the header is trusted only when the app names its proxies.
  if (seen && !trusted(seen)) {
    return formatAddress(seen);
  }
  if (proxies.length === 0) {
    return seen && formatAddress(seen);
  }
  for (let index = forwarded.length - 1; index >= 0; index--) {
    const address = forwarded[index]!;
    if (!trusted(address)) {
      return formatAddress(address);
    }
  }
  return seen && formatAddress(seen);
}
