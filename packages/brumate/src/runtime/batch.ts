// Reads of many keys at once. In the browser, the calls of one moment, such
// as the rows of a list that renders, become one call of a server function
// with every key. The server renders the rows of a list one after another,
// so there each call reads its own key at once.

export interface BatchOptions<K> {
  /**
   * What makes two calls the same key. Defaults to the key itself, and to
   * its JSON for an object.
   */
  key?: (key: K) => unknown;
  /** The most keys in one call. A larger batch becomes several calls. */
  limit?: number;
  /** How long a batch gathers calls, in milliseconds. Defaults to 0, until the next task. */
  wait?: number;
}

interface Waiter<V> {
  resolve: (value: V) => void;
  reject: (error: unknown) => void;
}

/** True while the server answers a request, from `request.ts`. A symbol of the registry, so the browser has none. */
const IN_REQUEST = Symbol.for('brumate.inRequest');

/** True on the server, or in a test while server code runs. */
function onServer(): boolean {
  const inRequest = (globalThis as Record<symbol, (() => boolean) | undefined>)[IN_REQUEST];
  return typeof document === 'undefined' || inRequest?.() === true;
}

function identity(key: unknown): unknown {
  return key !== null && typeof key === 'object' ? JSON.stringify(key) : key;
}

/**
 * Gives a function of one key, whose calls in the same moment become one
 * call of `readMany` with every distinct key. Each call gets its value from
 * `lookup`, with what `readMany` returned and its key.
 *
 * A failed read rejects only the calls that it read for, and a `lookup` that
 * throws rejects only the calls of its key.
 */
export function batched<K, R, V>(
  readMany: (keys: K[]) => R | Promise<R>,
  lookup: (found: R, key: K) => V,
  options: BatchOptions<K> = {},
): (key: K) => Promise<Awaited<V>> {
  const getKey = options.key ?? identity;
  const limit = Math.max(1, options.limit ?? Infinity);
  let pending = new Map<unknown, { key: K; waiters: Waiter<Awaited<V>>[] }>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function read(entries: { key: K; waiters: Waiter<Awaited<V>>[] }[]): Promise<void> {
    const keys: K[] = [];
    for (const entry of entries) {
      keys.push(entry.key);
    }
    let found: R;
    try {
      found = await readMany(keys);
    } catch (error) {
      for (const entry of entries) {
        for (const waiter of entry.waiters) {
          waiter.reject(error);
        }
      }
      return;
    }
    for (const entry of entries) {
      try {
        // A promise that `lookup` returns settles each call by itself.
        const value = lookup(found, entry.key) as Awaited<V>;
        for (const waiter of entry.waiters) {
          waiter.resolve(value);
        }
      } catch (error) {
        for (const waiter of entry.waiters) {
          waiter.reject(error);
        }
      }
    }
  }

  function flush(): void {
    timer = undefined;
    const entries = [...pending.values()];
    pending = new Map();
    for (let start = 0; start < entries.length; start += limit) {
      void read(entries.slice(start, start + limit));
    }
  }

  return (key) => {
    if (onServer()) {
      // One read for the key, at once, so it reads the event of the request and shares the
      // result of equal calls in the render.
      return (async () => lookup(await readMany([key]), key))() as Promise<Awaited<V>>;
    }
    return new Promise<Awaited<V>>((resolve, reject) => {
      const id = getKey(key);
      let entry = pending.get(id);
      if (!entry) {
        entry = { key, waiters: [] };
        pending.set(id, entry);
      }
      entry.waiters.push({ resolve, reject });
      timer ??= setTimeout(flush, options.wait ?? 0);
    });
  };
}
