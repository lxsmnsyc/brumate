// Results of server code that requests share, by their arguments, for a time.
// A store keeps them as text, so a store of another process, such as Redis,
// can keep them too. Tags name what a result depends on, and `revalidate`
// drops every result of a tag.

import { fromJSON, toJSON } from 'seroval';
import { currentEvent, withEvent } from './request.ts';
import { disabledFeatures, syncPlugins } from './serial.ts';

/**
 * Where cached results live. Values are text. `maxAge` is in seconds, after
 * which the store can drop the value. Each method can return a promise.
 */
export interface CacheStore {
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  set(key: string, value: string, maxAge: number): Promise<void> | void;
}

interface Entry {
  /** The value, as seroval writes it. */
  value: unknown;
  /** When the value expires, in milliseconds since 1970. */
  expires: number;
  /** The version of each tag when the value was made. */
  tags: Record<string, string>;
}

/** Tags live longer than any result, so a result never outlives the version of its tag. */
const TAG_AGE = 365 * 24 * 60 * 60;

/**
 * A store in the memory of the server, the default. Each process has its
 * own, and it keeps at most `size` values, dropping the oldest first.
 */
export function memoryStore(size = 1000): CacheStore & { readonly memory: true } {
  const values = new Map<string, { value: string; expires: number }>();
  return {
    memory: true,
    get(key) {
      const item = values.get(key);
      if (!item) {
        return undefined;
      }
      if (item.expires <= Date.now()) {
        values.delete(key);
        return undefined;
      }
      return item.value;
    },
    set(key, value, maxAge) {
      values.delete(key);
      values.set(key, { value, expires: Date.now() + maxAge * 1000 });
      for (const oldest of values.keys()) {
        if (values.size <= size) {
          break;
        }
        values.delete(oldest);
      }
    },
  };
}

let store: CacheStore = memoryStore();

/**
 * Sets the store of `cached`, such as one that keeps results in Redis for
 * every process of the app. Set it before the first request.
 */
export function setCacheStore(next: CacheStore): void {
  store = next;
}

/** The store of unstorage, which Nitro gives as `useStorage()`. */
interface Storage {
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: string, options?: { ttl?: number }): Promise<void>;
}

/** A store of `cached` from an unstorage storage, such as Nitro's `useStorage('cache')`. */
export function storageStore(storage: Storage): CacheStore {
  return {
    get: async (key) => {
      const value = await storage.getItem(key);
      return typeof value === 'string' ? value : undefined;
    },
    set: (key, value, maxAge) => storage.setItem(key, value, { ttl: maxAge }),
  };
}

export interface CachedOptions<A extends unknown[]> {
  /** Seconds that a result is used for the same arguments. */
  maxAge: number;
  /** What a result depends on, for `revalidate`. A function gets the arguments. */
  tags?: string[] | ((...args: A) => string[]);
  /**
   * The name of the results in the store. A store that other processes
   * share, such as Redis, needs one, so each process finds the same results.
   */
  name?: string;
}

/** Calls that are running, by key, so calls with the same arguments share one run. */
const running = new Map<string, Promise<unknown>>();
let unnamed = 0;

/** The text of a value, as the store keeps it. */
function write(value: unknown): unknown {
  return toJSON(value, { plugins: syncPlugins, disabledFeatures });
}

/**
 * Makes a function that keeps its results for `maxAge` seconds, by its
 * arguments, and returns a kept result in place of running again. Use it for
 * data that every user sees the same, such as a list of products.
 *
 * - The function runs without the request: `getEvent()` throws in it, so a
 *   result never holds one user's data. Pass what it needs as arguments.
 * - Arguments and results are values that brumate can send, such as plain
 *   objects, arrays, dates and maps.
 * - Calls with the same arguments while one runs share that run.
 * - `revalidate(tag)` drops the results of a tag.
 */
export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R> | R,
  options: CachedOptions<A>,
): (...args: A) => Promise<Awaited<R>> {
  const id = options.name ?? `#${unnamed++}`;
  return async (...args: A): Promise<Awaited<R>> => {
    if (options.name === undefined && !('memory' in store)) {
      throw new Error(
        'Give cached a name, such as cached(fn, { name: "products", maxAge: 60 }), so every process finds its results in the store',
      );
    }
    const key = `brumate:cache:${id}:${JSON.stringify(write(args))}`;
    const tags = typeof options.tags === 'function' ? options.tags(...args) : (options.tags ?? []);
    // A page that uses the result depends on its tags too.
    const event = currentEvent();
    for (const tag of tags) {
      if (!event?.cacheTags.has(tag)) {
        event?.cacheTags.set(tag, undefined);
      }
    }
    const versions = await tagVersions(tags);
    for (const tag of tags) {
      if (event?.cacheTags.get(tag) === undefined) {
        event?.cacheTags.set(tag, versions[tag]);
      }
    }
    const kept = await store.get(key);
    if (kept) {
      const entry = JSON.parse(kept) as Entry;
      if (entry.expires > Date.now() && tags.every((tag) => entry.tags[tag] === versions[tag])) {
        return fromJSON(entry.value as never, { plugins: syncPlugins }) as Awaited<R>;
      }
    }
    let run = running.get(key) as Promise<Awaited<R>> | undefined;
    if (!run) {
      const started = (async (): Promise<Awaited<R>> => {
        const value = await withEvent(undefined, () => fn(...args));
        const entry: Entry = {
          value: write(value),
          expires: Date.now() + options.maxAge * 1000,
          tags: versions,
        };
        await store.set(key, JSON.stringify(entry), options.maxAge);
        return value;
      })();
      run = started;
      running.set(key, started);
      void started.then(
        () => running.delete(key),
        () => running.delete(key),
      );
    }
    // Each caller gets its own copy, so one cannot change the result of another.
    return fromJSON(write(await run) as never, { plugins: syncPlugins }) as Awaited<R>;
  };
}

/** The store of `cached`, which the page cache of the server shares. */
export function cacheStore(): CacheStore {
  return store;
}

/** The versions of tags. A tag that was never revalidated has version `0`. */
export async function tagVersions(tags: Iterable<string>): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  await Promise.all(
    [...tags].map(async (tag) => {
      versions[tag] = (await store.get(`brumate:tag:${tag}`)) ?? '0';
    }),
  );
  return versions;
}

let revalidations = 0;

/**
 * Drops the results of `cached` functions with these tags, such as after a
 * server function changes the data. The next call runs the function again.
 * To show the new data on the page, call `refresh` too.
 */
export async function revalidate(...tags: string[]): Promise<void> {
  const version = `${Date.now()}.${revalidations++}`;
  await Promise.all(tags.map((tag) => store.set(`brumate:tag:${tag}`, version, TAG_AGE)));
}
