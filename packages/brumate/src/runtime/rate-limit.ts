// Rate limits for server functions, endpoints and pages. A limit counts the
// requests of each key, such as the user or the address of the client, in a
// sliding window, and answers 429 with `Retry-After` once a key has made too
// many.

import { RequestEvent, ServerError, getEvent } from './request.ts';
import type { Middleware } from './router.ts';

/**
 * Where a limit keeps its counts. The default counts in memory, per
 * process. An app with more than one server passes a store on Redis or a
 * platform store, whose `increment` is one atomic command, such as `INCR`
 * with `EXPIRE`. A limit decides on the count that `increment` returns, so
 * requests at the same time cannot all read one count and all pass.
 */
export interface RateLimitStore {
  /**
   * Adds one to the count of a key, which expires after `ttl` milliseconds,
   * and returns the new count, in one atomic step.
   */
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
   * What to count by, from the event and the arguments of the call, such as
   * the ID of the user in `event.locals`, or the email of a sign-in form.
   * Without a key, or when it returns undefined, the limit counts by the
   * address of the client that the server passed. Each server function, or
   * each route for middleware, counts on its own, whatever the key.
   */
  key?: (event: RequestEvent, args: unknown[]) => string | undefined | Promise<string | undefined>;
  /** The event of the request. Defaults to `getEvent()`. */
  event?: RequestEvent;
  /** The store of the counts. Defaults to the store of `configureRateLimit`, or memory. */
  store?: RateLimitStore;
  /** Whether the limit counts. Defaults to `configureRateLimit`, which is on. */
  enabled?: boolean;
}

export interface RateLimitConfig {
  /** The store of every limit that names none. Defaults to memory, which counts per process. */
  store?: RateLimitStore;
  /**
   * The proxies in front of the server, as addresses or CIDR ranges, such
   * as `10.0.0.0/8`. `clientAddress` reads `X-Forwarded-For` when the
   * address that the server saw is one of them. A range that is not an
   * address, with or without a prefix length, throws.
   */
  proxies?: string[];
  /** Whether limits count. Defaults to true. Pages that the build prerenders never count. */
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
  function sweep(): void {
    if (++sweeps % 1000 !== 0) {
      return;
    }
    const time = now();
    for (const [key, entry] of counts) {
      if (entry.expires <= time) {
        counts.delete(key);
      }
    }
  }
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
  // A typo in a range throws here, rather than trusting the wrong addresses later.
  for (const range of options.proxies ?? []) {
    parseRange(range);
  }
  Object.assign(config, options);
}

/** Replaces the clock of the limits, for tests. Returns the clock from before. */
export function setRateLimitClock(now: () => number): () => number {
  const previous = clock;
  clock = now;
  memory = createMemoryStore(now);
  warned = false;
  return previous;
}

/** True in development and in tests, from `NODE_ENV`. A runtime without it is production. */
function isDevelopment(): boolean {
  const process = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const mode = process?.env?.NODE_ENV;
  return mode === 'development' || mode === 'test';
}

/**
 * What a limit counts per: the server function, the pattern of the route,
 * such as `/api/[id]`, or one count for every path that no route matches.
 */
function getTarget(event: RequestEvent): string {
  return event.call?.id ?? event.route ?? '(no route)';
}

/**
 * The key of a request: the key of the app, or the address of the client.
 * Without either, callers would share one count, and one client could use
 * up the limit of all. So it throws in production. In development it warns
 * once and returns undefined, and the limit does not count.
 */
async function readKey(
  event: RequestEvent,
  options: RateLimitOptions,
): Promise<string | undefined> {
  const key = (await options.key?.(event, event.call?.args ?? [])) ?? clientAddress(event);
  if (key !== undefined) {
    return key;
  }
  const message = `rateLimit: the request to "${getTarget(event)}" has no key, because the server did not pass the address of the client. Pass \`address\` to the handler of the server, or set \`key\` on the limit.`;
  if (!isDevelopment()) {
    throw new Error(message);
  }
  if (!warned) {
    warned = true;
    console.warn(`${message} Until then, the limit does not count in development.`);
  }
  return undefined;
}

/**
 * Counts a request, and throws a `RateLimitError` when its key has made
 * more than `max` requests in the window.
 */
async function check(event: RequestEvent, options: RateLimitOptions): Promise<void> {
  if (event.prerender || !(options.enabled ?? config.enabled ?? true)) {
    return;
  }
  const key = await readKey(event, options);
  if (key === undefined) {
    return;
  }
  const name = `${key} ${getTarget(event)}`;
  const store = options.store ?? config.store ?? (memory ??= createMemoryStore(clock));
  const window = windowMs(options.window);
  const now = clock();
  const bucket = Math.floor(now / window);
  const elapsed = now - bucket * window;
  // Two counts per key, this window and the last. The last one weighs by how much of it is still
  // inside the sliding window, so a burst at the edge of a window does not get through. The
  // request counts first, and the limit decides on the count that the store returns, so requests
  // at the same time each get their own count. A refused request counts too, so a client that
  // keeps trying stays refused until it slows down.
  const [current, previous = 0] = await Promise.all([
    store.increment(`${name} ${bucket}`, window * 2),
    store.get(`${name} ${bucket - 1}`),
  ]);
  const weight = 1 - elapsed / window;
  if (current + previous * weight <= options.max) {
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
 * Limits how often a key, such as the user or the address of the client,
 * can call a server function. Call it first thing in the function, before
 * its first `await`, as `getEvent()`:
 *
 * ```ts
 * async function signIn(email: string, password: string) {
 *   'use server';
 *   await rateLimit({ ...rateLimit.strict, key: () => email.toLowerCase() });
 *   // …
 * }
 * ```
 *
 * The fourth call in 10 seconds for one email rejects with a
 * `RateLimitError`, with status 429 and `Retry-After`, and the rest of the
 * function does not run. Without a `key`, the limit counts by the address
 * of the client, which the server passes to its handler as `address`. In
 * production, a limit with neither throws. `rateLimit.middleware(options)`
 * limits every request under a folder of routes, or of the whole app from
 * the entry.
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
   * Each route counts on its own, by its pattern, such as `/api/[id]`.
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
  if (parts.length !== 4) {
    return undefined;
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) >= 256) {
      return undefined;
    }
  }
  const bytes = new Uint8Array(16);
  bytes[10] = 0xff;
  bytes[11] = 0xff;
  for (const [index, part] of parts.entries()) {
    bytes[12 + index] = Number(part);
  }
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
  for (const byte of bytes.slice(0, 10)) {
    if (byte !== 0) {
      return false;
    }
  }
  return bytes[10] === 0xff && bytes[11] === 0xff;
}

/** A range of addresses, as its first address and the number of bits that must match. */
interface Range {
  base: Uint8Array;
  bits: number;
}

/**
 * Reads a range: an address, or a CIDR such as `10.0.0.0/8` or `fd00::/8`.
 * Throws for anything else, such as `10.0.0.0/` or `10.0.0.0/33`, since a
 * range that matched every address would trust any `X-Forwarded-For`.
 */
function parseRange(range: string): Range {
  const [text, length, ...extra] = range.split('/');
  const base = parseAddress(text!);
  const v4 = base !== undefined && isIPv4(base);
  if (
    !base ||
    extra.length > 0 ||
    (length !== undefined && (!/^\d{1,3}$/.test(length) || Number(length) > (v4 ? 32 : 128)))
  ) {
    throw new TypeError(
      `The proxy range "${range}" is not an address, or an address and a prefix length such as "10.0.0.0/8"`,
    );
  }
  // Addresses are 16 bytes, with an IPv4 one in the last 4, so its prefix length moves by 96.
  return { base, bits: length === undefined ? 128 : Number(length) + (v4 ? 96 : 0) };
}

function inParsedRange(address: Uint8Array, { base, bits }: Range): boolean {
  if (isIPv4(base) !== isIPv4(address)) {
    return false;
  }
  for (let bit = 0; bit < bits; bit++) {
    const mask = 0x80 >> (bit % 8);
    if (((address[bit >> 3]! ^ base[bit >> 3]!) & mask) !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * True if an address is in a range: an address, or a CIDR such as
 * `10.0.0.0/8` or `fd00::/8`. Throws for a range that is neither.
 */
export function inRange(address: Uint8Array, range: string): boolean {
  return inParsedRange(address, parseRange(range));
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
 * saw, which the handler of the server passes as `address`. When that
 * address is one of the proxies that `configureRateLimit({ proxies })`
 * names, it comes from `X-Forwarded-For`: the header is read from the right,
 * past the trusted proxies, because a client can write anything at its
 * left. An IPv6 address counts by its /64.
 *
 * Undefined when the server passed no address, whatever the headers say,
 * since nothing then shows that the header comes from a proxy. Undefined too
 * when the first hop past the proxies is not an address.
 */
export function clientAddress(
  event: RequestEvent,
  proxies: string[] = config.proxies ?? [],
): string | undefined {
  const seen = event.address === undefined ? undefined : parseAddress(event.address);
  if (!seen) {
    return undefined;
  }
  const ranges: ReturnType<typeof parseRange>[] = [];
  for (const proxy of proxies) {
    ranges.push(parseRange(proxy));
  }
  function trusted(address: Uint8Array): boolean {
    for (const range of ranges) {
      if (inParsedRange(address, range)) {
        return true;
      }
    }
    return false;
  }
  if (!trusted(seen)) {
    return formatAddress(seen);
  }
  const hops: string[] = [];
  for (const hop of (event.request.headers.get('x-forwarded-for') ?? '').split(',')) {
    if (hop.trim() !== '') {
      hops.push(hop);
    }
  }
  let client = seen;
  for (let index = hops.length - 1; index >= 0; index--) {
    const address = parseAddress(hops[index]!);
    // A hop that is not an address stops here, rather than reading what the client wrote left of it.
    if (!address) {
      return undefined;
    }
    client = address;
    if (!trusted(address)) {
      break;
    }
  }
  // When every hop is a proxy, the request comes from the first of them.
  return formatAddress(client);
}
