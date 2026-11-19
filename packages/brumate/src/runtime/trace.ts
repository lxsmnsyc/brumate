/** The names of spans. The `brumate.event` family is made in the browser. */
export type TraceName =
  | 'brumate.request'
  | 'brumate.render'
  | 'brumate.stream'
  | 'brumate.memo'
  | 'brumate.call'
  | 'brumate.body'
  | 'brumate.event'
  | 'brumate.load'
  | 'brumate.run'
  | 'brumate.navigation'
  | 'brumate.fetch';

/** A step of the work, handed to `onTrace` when it ends. */
export interface TraceSpan {
  name: TraceName;
  /** The component, function, route or event it is about, such as `GET /todos`, `Todos#add`, `click`. */
  label: string;
  /** 32 hex characters. */
  traceId: string;
  /** 16 hex characters. */
  spanId: string;
  /** The `spanId` of the parent. For a root, the parent of an incoming `traceparent`, if any. */
  parentId?: string;
  /** Epoch milliseconds, with a fraction. */
  start: number;
  /** Epoch milliseconds, with a fraction. */
  end: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  /** When `status` is `'error'`. It has no stack. */
  error?: { message: string };
}

/** The `onTrace` export of `src/middleware.ts`. */
export type TraceHandler = (span: TraceSpan) => void | Promise<void>;

/** Ends a span. `failed` and the error that caused it are for a span that did not finish well. */
export type EndSpan = (failed?: boolean, error?: unknown) => void;

/** What a span of the request is made from. A `RequestEvent` or the root of a render. */
export interface Traceable {
  tracer?: Tracer;
}

export function noSpan(): void {}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/** The trace and parent of a `traceparent` header, or none when it is not valid. */
export function readTraceparent(
  header: string | null | undefined,
): { traceId: string; parentId: string } | undefined {
  const match = header ? TRACEPARENT.exec(header.trim()) : null;
  if (!match || /^0+$/.test(match[1]!) || /^0+$/.test(match[2]!)) {
    return undefined;
  }
  return { traceId: match[1]!, parentId: match[2]! };
}

function randomHex(bytes: number): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let hex = '';
  for (const byte of data) {
    hex += byte.toString(16).padStart(2, '0');
  }
  // All zeros is not a valid ID.
  return /^0+$/.test(hex) ? randomHex(bytes) : hex;
}

function now(): number {
  return performance.timeOrigin + performance.now();
}

/** What the spans of one request or render share. Made only when the app has an `onTrace`. */
export class Tracer {
  readonly traceId: string;
  /** The parent of an incoming `traceparent`. */
  readonly incoming: string | undefined;
  /** The `spanId` of the span of the request. */
  root: string | undefined;
  /** The `spanId` of the latest render. */
  render: string | undefined;
  /** The attributes of the span of the request, which the server fills in as it learns them. */
  readonly attributes: TraceSpan['attributes'] = {};
  readonly handler: TraceHandler;
  /** The spans that began and have not ended, except the request, so an aborted request can end them. */
  readonly open: Set<EndSpan> = new Set();
  /** The first error that failed a span, which a 5xx answer of the request is the sign of. */
  fault: unknown;
  /** True once a span ended with an answer error such as a `ServerError`, which can have a 5xx status. */
  answered = false;

  constructor(handler: TraceHandler, traceparent?: string | null) {
    const parent = readTraceparent(traceparent);
    this.handler = handler;
    this.traceId = parent?.traceId ?? randomHex(16);
    this.incoming = parent?.parentId;
  }
}

/** Gives the span to `onTrace`. A throw or a rejection is logged and changes nothing else. */
function emit(handler: TraceHandler, span: TraceSpan): void {
  try {
    const result = handler(span);
    if (result && typeof result.then === 'function') {
      result.then(undefined, (error: unknown) => console.error(error));
    }
  } catch (error) {
    console.error(error);
  }
}

/** The classes of errors that are answers, not faults: `ServerError` and `Redirect`. `request.ts` adds them. */
export const answerErrors: (abstract new (...args: never[]) => Error)[] = [];

function isAnswer(error: unknown): boolean {
  for (const type of answerErrors) {
    if (error instanceof type) {
      return true;
    }
  }
  return false;
}

/** The message of an error, without its stack. */
function failure(error: unknown): { message: string } {
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Starts a span and returns what ends it, which hands the span to `onTrace`.
 * A span that is never ended is never handed over. Call it only when
 * `source.tracer` is set.
 */
export function startSpan(source: Traceable, name: TraceName, label: string): EndSpan {
  const tracer = source.tracer;
  if (!tracer) {
    return noSpan;
  }
  const spanId = randomHex(8);
  const start = now();
  let parentId: string | undefined;
  if (name === 'brumate.request') {
    parentId = tracer.incoming;
    tracer.root = spanId;
  } else if (name === 'brumate.render' || name === 'brumate.stream') {
    parentId = tracer.root ?? tracer.incoming;
    if (name === 'brumate.render') {
      tracer.render = spanId;
    }
  } else {
    parentId = tracer.render ?? tracer.root ?? tracer.incoming;
  }
  let done = false;
  const end: EndSpan = (failed, error) => {
    if (done) {
      return;
    }
    done = true;
    tracer.open.delete(end);
    let status: TraceSpan['status'] = 'ok';
    if (failed && isAnswer(error)) {
      tracer.answered = true;
    } else if (failed) {
      status = 'error';
      tracer.fault ??= error ?? new Error('failed');
    }
    const span: TraceSpan = {
      name,
      label,
      traceId: tracer.traceId,
      spanId,
      start,
      end: now(),
      status,
      attributes: name === 'brumate.request' ? { ...tracer.attributes } : {},
    };
    if (parentId !== undefined) {
      span.parentId = parentId;
    }
    if (status === 'error') {
      span.error = failure(error);
    }
    emit(tracer.handler, span);
  };
  if (name !== 'brumate.request') {
    tracer.open.add(end);
  }
  return end;
}

/**
 * Ends the span of a request when its response has been read to the end, or
 * its reader left or failed, or the request aborted. Spans of the request
 * that are still open, such as a `#loading` body, end as failed then.
 * Returns the response to send, which has the same body.
 *
 * Rebuilding the response is deliberate. It happens only when `onTrace` is
 * set, because the body must pass through a stream that sees its end.
 */
export function traceResponse(
  source: Traceable,
  end: EndSpan,
  response: Response,
  signal?: AbortSignal,
): Response {
  const tracer = source.tracer!;
  tracer.attributes['http.status_code'] = response.status;
  function finish(reason?: unknown): void {
    if (reason !== undefined) {
      const aborted = reason instanceof Error ? reason : new Error('The request was aborted');
      // Deleting from a set while iterating it is safe.
      for (const open of tracer.open) {
        open(true, aborted);
      }
      end(true, aborted);
      return;
    }
    // A 5xx answer fails the span unless an answer error, such as a `ServerError`, made it.
    const failed = tracer.fault !== undefined || (response.status >= 500 && !tracer.answered);
    end(failed, failed ? (tracer.fault ?? new Error(`HTTP ${response.status}`)) : undefined);
  }
  if (!response.body) {
    finish();
    return response;
  }
  signal?.addEventListener('abort', () => finish(signal.reason ?? true), { once: true });
  // `cancel` runs when the reader cancels or the source fails. The TypeScript library does not know it yet.
  const watcher = { flush: () => finish(), cancel: (reason: unknown) => finish(reason ?? true) };
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(watcher));
  const headers = new Headers(response.headers);
  const result = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  // A DOM environment drops `set-cookie` from the headers that a response is made with.
  if (result.headers.getSetCookie().length === 0) {
    for (const cookie of headers.getSetCookie()) {
      result.headers.append('set-cookie', cookie);
    }
  }
  return result;
}

/** What `traceRequest` reads of a request event. */
interface Traced extends Traceable {
  request: Request;
  signal: AbortSignal;
}

/**
 * Runs the work of a request inside its `brumate.request` span. The span
 * ends with the response, and not at all when `run` gives none. `route` is
 * the pattern of the route, never the URL.
 */
export async function traceRequest(
  event: Traced,
  route: string,
  kind: () => string,
  run: () => Promise<Response | undefined>,
): Promise<Response | undefined> {
  const tracer = event.tracer;
  if (!tracer) {
    return run();
  }
  const method = event.request.method;
  tracer.attributes['http.method'] = method;
  tracer.attributes['http.route'] = route;
  const end = startSpan(event, 'brumate.request', `${method} ${route}`);
  let response: Response | undefined;
  try {
    response = await run();
  } catch (error) {
    tracer.attributes['brumate.kind'] = kind();
    tracer.attributes['http.status_code'] = 500;
    end(true, error);
    throw error;
  }
  tracer.attributes['brumate.kind'] = kind();
  return response && traceResponse(event, end, response, event.signal);
}
