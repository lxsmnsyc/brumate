// The record of a server function call for the dock, in development only.
//
// The dev server runs each call inside a collector: it gathers the `console.*` output of the call,
// the server functions it called, the error with its stack, and sends them back in the
// `x-brumate-dev` header of the answer. The browser decodes the arguments and the result itself and
// joins both into a `CallRecord`. Nothing here is imported by a production build: the dev server
// and the devtools load it. No cookies and no headers are recorded, and values are cut at a length.

import type { CallRecord, DevAnswer, ServerRecord } from './devtools.ts';

export type { CallRecord, DevAnswer, ServerRecord } from './devtools.ts';

/** The header that the dev server answers with. A production server never sets it. */
export const DEV_HEADER = 'x-brumate-dev';

/** The longest text of a value, a log line or a stack, in characters. */
export const TEXT_LIMIT = 1000;
const STACK_LIMIT = 2000;
const ITEM_LIMIT = 50;
const DEPTH_LIMIT = 5;
/** The longest header, once encoded. Servers refuse headers of about 8 kB and more. */
const HEADER_LIMIT = 6000;

/** The hook of `dedupe` in the server core, under a symbol of the registry. */
const CALL_HOOK = Symbol.for('brumate.callHook');
const LOG_SINK = Symbol.for('brumate.devLogSink');
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/** Cuts a text at a length, and marks the cut. */
export function cutText(text: string, limit: number = TEXT_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit)}… (${text.length - limit} more)` : text;
}

/**
 * A copy of a value that is safe to keep and show: text cut, at most 50 items in a list or an
 * object, 5 levels deep, no cycles. Functions, symbols, files and errors become text.
 */
export function cutValue(
  value: unknown,
  depth: number = 0,
  seen: Set<object> = new Set<object>(),
): unknown {
  switch (typeof value) {
    case 'string':
      return cutText(value);
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return value.toString();
    case 'function':
      return `[Function ${value.name || 'anonymous'}]`;
    case 'object':
      break;
    default:
      return value;
  }
  if (value === null || value instanceof Date) {
    return value;
  }
  if (value instanceof Error) {
    return cutText(`[${value.name}: ${value.message}]`);
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const name = (value as Partial<File>).name;
    return `[${name === undefined ? 'Blob' : `File ${name}`}, ${value.size} bytes, ${value.type}]`;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= DEPTH_LIMIT) {
    return Array.isArray(value) ? '[Array]' : '[Object]';
  }
  seen.add(value);
  let result: unknown;
  if (Array.isArray(value) || value instanceof Set) {
    const items: unknown[] = [];
    for (const item of value) {
      if (items.length === ITEM_LIMIT) {
        items.push(`… ${(Array.isArray(value) ? value.length : value.size) - ITEM_LIMIT} more`);
        break;
      }
      items.push(cutValue(item, depth + 1, seen));
    }
    result = value instanceof Set ? new Set(items) : items;
  } else if (value instanceof Map) {
    const entries: [unknown, unknown][] = [];
    for (const [key, item] of value) {
      if (entries.length === ITEM_LIMIT) {
        break;
      }
      entries.push([cutValue(key, depth + 1, seen), cutValue(item, depth + 1, seen)]);
    }
    result = new Map(entries);
  } else if (typeof FormData !== 'undefined' && value instanceof FormData) {
    result = cutValue(Object.fromEntries(value), depth, seen);
  } else {
    const copy: Record<string, unknown> = {};
    let count = 0;
    for (const key of Object.keys(value)) {
      if (count === ITEM_LIMIT) {
        copy['…'] = `${Object.keys(value).length - ITEM_LIMIT} more`;
        break;
      }
      copy[key] = cutValue((value as Record<string, unknown>)[key], depth + 1, seen);
      count++;
    }
    result = copy;
  }
  seen.delete(value);
  return result;
}

/** What went wrong in a call, with a stack that is cut. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: cutText(error.message),
      ...(error.stack ? { stack: cutText(error.stack, STACK_LIMIT) } : {}),
    };
  }
  return { message: cutText(String(error)) };
}

/** Writes the server part of a record for the header. It shrinks the record to fit. */
export function encodeServerRecord(record: DevAnswer): string {
  const copy: DevAnswer = { ...record, logs: [...record.logs] };
  let text = encodeURIComponent(JSON.stringify(copy));
  while (text.length > HEADER_LIMIT && copy.logs.length > 0) {
    copy.logs.length = Math.floor(copy.logs.length / 2);
    copy.truncated = true;
    text = encodeURIComponent(JSON.stringify(copy));
  }
  if (text.length > HEADER_LIMIT && copy.error?.stack) {
    delete copy.error.stack;
    text = encodeURIComponent(JSON.stringify(copy));
  }
  if (text.length > HEADER_LIMIT) {
    copy.calls.length = Math.min(copy.calls.length, 10);
    copy.reads.length = Math.min(copy.reads.length, 10);
    text = encodeURIComponent(JSON.stringify(copy));
  }
  return text;
}

/** Reads the header of the dev server, or undefined when the answer has none. */
export function decodeServerRecord(header: string | null): DevAnswer | undefined {
  if (!header) {
    return undefined;
  }
  try {
    return JSON.parse(decodeURIComponent(header)) as DevAnswer;
  } catch {
    return undefined;
  }
}

// The dev server.

/** The part of `AsyncLocalStorage` that the collector needs, so this module imports no Node module. */
interface Storage {
  run<R>(store: Collector, callback: () => R): R;
  getStore(): Collector | undefined;
}

interface Collector {
  top?: string;
  calls: string[];
  logs: { level: string; text: string }[];
  error?: { message: string; stack?: string };
}

type Hook = (id: string, run: () => unknown) => unknown;
type Globals = { [CALL_HOOK]?: Hook; [LOG_SINK]?: (level: string, args: unknown[]) => void };

/**
 * Sets up the recording of calls on the dev server. `storage` is an `AsyncLocalStorage`, and
 * `format` is `util.format`. Returns what wraps the handling of one call: it runs the handler,
 * and adds the header to the answer. `console.*` is patched once for the process.
 */
export function createRecorder(
  storage: Storage,
  format: (...args: unknown[]) => string,
): (run: () => Promise<Response>) => Promise<Response> {
  const globals = globalThis as Globals;
  // The server core calls this around every server function that is not part of a page render.
  globals[CALL_HOOK] = (id, run) => {
    const collector = storage.getStore();
    if (!collector) {
      return run();
    }
    if (collector.top !== undefined) {
      if (collector.calls.length < ITEM_LIMIT) {
        collector.calls.push(id);
      }
      return run();
    }
    // The first call is the one the browser made. Its error is recorded, and passes on.
    collector.top = id;
    let result: unknown;
    try {
      result = run();
    } catch (error) {
      collector.error = describeError(error);
      throw error;
    }
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      (result as Promise<unknown>).catch((error: unknown) => {
        collector.error = describeError(error);
      });
    }
    return result;
  };
  const wasPatched = globals[LOG_SINK] !== undefined;
  globals[LOG_SINK] = (level, args) => {
    const collector = storage.getStore();
    if (collector && collector.logs.length < ITEM_LIMIT) {
      collector.logs.push({ level, text: cutText(format(...args)) });
    }
  };
  if (!wasPatched) {
    for (const level of LEVELS) {
      const original = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        (globalThis as Globals)[LOG_SINK]?.(level, args);
        original(...args);
      };
    }
  }
  return async (run) => {
    const collector: Collector = { calls: [], logs: [] };
    const answer = await storage.run(collector, run);
    // A redirect is not an error.
    const redirected = answer.headers.has('x-brumate-redirect');
    const refreshed = answer.headers.get('x-brumate-refresh');
    const record: DevAnswer = {
      reads: refreshed ? refreshed.split(',') : [],
      calls: collector.calls,
      logs: collector.logs,
    };
    if (collector.error && !redirected) {
      record.error = collector.error;
    }
    answer.headers.set(DEV_HEADER, encodeServerRecord(record));
    return answer;
  };
}

// The browser.

/** What the browser knows of a call when its answer arrives. */
export interface CallInput {
  name: string;
  /** The `init` of the `fetch`: its body holds the arguments. */
  init?: RequestInit;
  response: Response;
  /** When `fetch` was called, by `performance.now()`. */
  started: number;
  /** When the headers arrived. */
  arrived: number;
  /** How long the page took to get to the call, such as to load the code and write the arguments. */
  module: number;
}

/**
 * Makes the record of a call: decodes its arguments and its result, and joins them with the part
 * that the dev server sent. `response` must be a clone, since this reads its body.
 */
export async function readCall(input: CallInput): Promise<CallRecord> {
  const { name, init, response, started, arrived } = input;
  const { error, ...server }: Partial<DevAnswer> =
    decodeServerRecord(response.headers.get(DEV_HEADER)) ?? {};
  const took = /brumate;dur=([\d.]+)/.exec(response.headers.get('server-timing') ?? '');
  const serverTime = took ? Number(took[1]) : 0;
  const record: CallRecord = {
    name,
    args: [],
    timing: {
      module: Math.round(input.module),
      network: Math.max(0, Math.round(arrived - started - serverTime)),
      server: Math.round(serverTime),
      decode: 0,
    },
    ...(server.logs ? { server: server as ServerRecord } : {}),
    ...(error ? { error } : {}),
  };
  const [{ fromJSON }, { callPlugins, serialOptions }, { fromChunkStream }] = await Promise.all([
    import('seroval'),
    import('./serial.ts'),
    import('./stream.ts'),
  ]);
  // The arguments: seroval JSON, or form data that holds it, or the fields of a form.
  try {
    const body = init?.body;
    if (typeof body === 'string') {
      const args = fromJSON(JSON.parse(body), {
        plugins: callPlugins(),
        ...serialOptions(),
      }) as unknown[];
      record.args = cutValue(args) as unknown[];
    } else if (body instanceof FormData) {
      if (body.has('args')) {
        const args = fromJSON(JSON.parse(String(body.get('args'))), {
          plugins: callPlugins(undefined, body),
          ...serialOptions(),
        }) as unknown[];
        record.args = cutValue(args) as unknown[];
      } else {
        record.args = [cutValue(body)];
      }
    }
  } catch {
    // The arguments cannot be read, such as ones of a plugin that is not loaded: none are shown.
  }
  // The result, or the message of the error that the server answered with.
  const decoding = performance.now();
  try {
    if (response.ok && !response.headers.has('x-brumate-redirect') && response.body) {
      record.result = cutValue(await fromChunkStream(response.body));
    } else if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        message = (JSON.parse(text) as { error: string }).error;
      } catch {
        // The body is not the error of a server function.
      }
      record.error ??= { message: cutText(message) };
    }
  } catch (failure) {
    record.error ??= {
      message: cutText(failure instanceof Error ? failure.message : String(failure)),
    };
  }
  record.timing.decode = Math.round(performance.now() - decoding);
  return record;
}
