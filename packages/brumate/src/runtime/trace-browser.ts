// The spans of the browser, for the `onTrace` option of the loader: an event with the load of the
// code of its handler and the run of the handler, the server functions that the page calls, and
// navigations. Each caller sits behind `TRACE`, so a build without `onTrace` leaves this out.
//
// A span carries no arguments, results, query strings, form values or text.

import type { TraceHandler, TraceName, TraceSpan } from './trace.ts';

type Attributes = Record<string, string | number | boolean>;

/** Where a request that the page makes belongs: the trace and the span that it is a child of. */
export interface TraceContext {
  traceId: string;
  spanId: string;
}

interface Span extends TraceContext {
  label: string;
  end: (failed?: boolean, error?: unknown, attributes?: Attributes) => void;
}

/** The spans of one event handler. `boot` makes it, and the core calls it. */
export interface EventTrace {
  /** True when the handler waits for code, set by the loader and the core. */
  waits: boolean;
  /** The code of the handler has loaded, or failed to. Ends `brumate.load` when it waited. */
  ready: (failed?: boolean, error?: unknown) => void;
  /** Runs the handler inside `brumate.run`. Ends `brumate.event` when its result settles. */
  run: <T>(call: () => T) => T;
  /** Ends the event with an error, such as a handler whose code did not load. */
  fail: (error: unknown) => void;
}

/** A request that the page sends: a server function call or a navigation. */
export interface RequestTrace {
  /** The `traceparent` of the request, for a request to the same origin. */
  header?: string;
  span: Span;
  /** Ends the span with the status of the answer, or with the error of a request that failed. */
  end: (status?: number, error?: unknown, attributes?: Attributes) => void;
  /** Names a page by its route, from its path and the `b-params` of its state, and gives the route. */
  route: (path: string, params?: string | null) => string;
}

let handler: TraceHandler | undefined;
// The handler whose synchronous part runs now. A server function call or a navigation that it
// makes before its first `await` reads it. It is cleared when that part returns: handlers overlap,
// so a context that outlived it could give a call of one handler to the trace of another. A call
// after an `await`, or from a memo, is the root of a trace of its own.
let current: TraceContext | undefined;
// The event that is being dispatched, so its handlers share one trace.
let dispatch: { event: Event | undefined; traceId: string; start: number } | undefined;

/** Sets `onTrace`, or turns spans off with undefined. */
export function setTraceHandler(next: TraceHandler | undefined): void {
  handler = next;
  current = dispatch = undefined;
}

/** The trace that a server function call or a navigation made now joins. */
export function traceContext(): TraceContext | undefined {
  return handler ? current : undefined;
}

function now(): number {
  return performance.timeOrigin + performance.now();
}

function randomHex(bytes: number): string {
  let text = '';
  for (const byte of crypto.getRandomValues(new Uint8Array(bytes))) {
    text += byte.toString(16).padStart(2, '0');
  }
  return text;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emit(span: TraceSpan): void {
  try {
    const result = handler?.(span);
    if (result) {
      // A rejection is logged and changes nothing.
      Promise.resolve(result).catch((error: unknown) => console.error(error));
    }
  } catch (error) {
    console.error(error);
  }
}

function startSpan(
  name: TraceName,
  label: string,
  traceId: string,
  parentId?: string,
  start = now(),
  attributes: Attributes = {},
): Span {
  const spanId = randomHex(8);
  let ended = false;
  const span: Span = {
    traceId,
    spanId,
    label,
    end(failed, error, more) {
      // A span ends once, such as an event whose handler throws and whose promise rejects.
      if (ended) {
        return;
      }
      ended = true;
      emit({
        name,
        label: span.label,
        traceId,
        spanId,
        ...(parentId === undefined ? {} : { parentId }),
        start,
        end: now(),
        status: failed ? 'error' : 'ok',
        attributes: more ? { ...attributes, ...more } : attributes,
        ...(failed ? { error: { message: messageOf(error) } } : {}),
      });
    },
  };
  return span;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

/**
 * Starts the spans of an event handler, or none when the page has no `onTrace`. The handlers of one
 * event share a trace. `ref` names the handler, such as `Todos#add`, and `waits` is true when
 * the core is not loaded yet.
 */
export function traceEvent(
  event: Event | undefined,
  ref: string,
  waits: boolean,
): EventTrace | undefined {
  if (!handler) {
    return undefined;
  }
  // The start is the listener, before any code loads.
  if (!event || dispatch?.event !== event) {
    dispatch = { event, traceId: randomHex(16), start: now() };
  }
  const { traceId, start } = dispatch;
  const type = event?.type ?? 'client';
  const name = ref.split('@')[0]!;
  const root = startSpan('brumate.event', `${type} ${name}`, traceId, undefined, start, {
    'brumate.event.type': type,
  });
  const trace: EventTrace = {
    waits,
    ready(failed, error) {
      if (trace.waits || failed) {
        const load = startSpan('brumate.load', name.split('#')[0]!, traceId, root.spanId, start);
        load.end(failed, error);
      }
    },
    run(call) {
      const span = startSpan('brumate.run', name, traceId, root.spanId);
      function finish(failed?: boolean, error?: unknown): void {
        span.end(failed, error);
        root.end(failed, error);
      }
      let value: ReturnType<typeof call>;
      current = { traceId, spanId: span.spanId };
      try {
        value = call();
      } catch (error) {
        finish(true, error);
        throw error;
      } finally {
        current = undefined;
      }
      if (isThenable(value)) {
        value.then(
          () => finish(),
          (error: unknown) => finish(true, error),
        );
      } else {
        finish();
      }
      return value;
    },
    fail(error) {
      root.end(true, error);
    },
  };
  return trace;
}

/** The span of a navigation. It has the method only: the path can hold an ID, and is not known to be a route yet. */
export function traceNavigation(url: string, init?: RequestInit): RequestTrace | undefined {
  const method = init?.method ?? 'GET';
  return traceRequest('brumate.navigation', method, url, { 'http.method': method }, current);
}

/**
 * Starts the span of a request: `brumate.fetch` for a server function, or `brumate.navigation`.
 * It is a child of `parent`, or the root of a trace. Undefined when the page has no `onTrace`.
 */
export function traceRequest(
  name: 'brumate.fetch' | 'brumate.navigation',
  label: string,
  url: string,
  attributes: Attributes,
  parent?: TraceContext,
): RequestTrace | undefined {
  if (!handler) {
    return undefined;
  }
  const span = startSpan(
    name,
    label,
    parent?.traceId ?? randomHex(16),
    parent?.spanId,
    undefined,
    attributes,
  );
  // Another origin gets no header, as it would learn the trace of this page.
  const same = new URL(url, location.href).origin === location.origin;
  return {
    header: same ? `00-${span.traceId}-${span.spanId}-01` : undefined,
    span,
    end(status, error, more) {
      const failed = status === undefined || status >= 500;
      span.end(
        failed,
        error ?? `Status ${status}`,
        status === undefined ? more : { ...more, 'http.status_code': status },
      );
    },
    route(path, params) {
      const route = routeOf(path, params);
      span.label = `${span.label.split(' ')[0]} ${route}`;
      return route;
    },
  };
}

/**
 * The route of a page: its path with the values of its parameters, from `b-params`, written as
 * `[name]`, so the label has no ID of a user.
 */
function routeOf(path: string, params?: string | null): string {
  if (!params) {
    return path;
  }
  try {
    const names = new Map<string, string>();
    for (const [name, value] of Object.entries(JSON.parse(params) as Record<string, unknown>)) {
      if (typeof value === 'string') {
        names.set(value, name);
      }
    }
    const parts: string[] = [];
    for (const part of path.split('/')) {
      const name = names.get(decodeURIComponent(part));
      parts.push(name === undefined ? part : `[${name}]`);
    }
    return parts.join('/');
  } catch {
    return path;
  }
}
