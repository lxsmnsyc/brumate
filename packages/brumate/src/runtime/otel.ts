import type * as Api from '@opentelemetry/api';
import type { TraceHandler, TraceSpan } from './trace.ts';

type OtelApi = typeof Api;

export type { TraceHandler, TraceSpan };

export interface OtelOptions {
  /** The name of the tracer. Defaults to `brumate`. */
  tracerName?: string;
  /** The `@opentelemetry/api` module. Without it, the adapter imports the package. */
  api?: OtelApi;
}

/** How long a span waits for its parent, in milliseconds. */
const PARENT_WAIT = 60_000;
/** How often the waiting spans are checked for age, in milliseconds. */
const SWEEP_EVERY = 5_000;
/** The most spans that wait; past it the oldest are exported as roots. */
const MAX_WAITING = 10_000;

interface Queue {
  /** Spans by the id of the parent they wait for. */
  byParent: Map<string, Waiting[]>;
  count: number;
  lastSweep: number;
}

interface Waiting {
  span: TraceSpan;
  since: number;
}

/**
 * Makes an OpenTelemetry span for each brumate span, with the same trace and parent ids, times,
 * attributes and status. The SDK makes the span ids.
 */
export function otel(options: OtelOptions = {}): TraceHandler {
  const name = options.tracerName ?? 'brumate';
  const ready = loadApi(options.api);
  // Spans arrive child first, so a span waits here until its parent ends. A span with no parent
  // here, or with one from an incoming traceparent, starts the export of its tree.
  const waiting: Queue = { byParent: new Map(), count: 0, lastSweep: 0 };
  let reported = false;

  return async function onTrace(span) {
    const loaded = await ready;
    if (loaded instanceof Error) {
      // Throw once; the server logs it.
      if (reported) {
        return;
      }
      reported = true;
      throw loaded;
    }
    const tracer = loaded.trace.getTracer(name);
    const now = Date.now();
    if (now - waiting.lastSweep >= SWEEP_EVERY) {
      waiting.lastSweep = now;
      sweep(waiting, now, PARENT_WAIT, (orphan) => {
        exportTree(loaded, tracer, orphan, waiting, undefined);
      });
    }
    if (span.parentId !== undefined && span.name !== 'brumate.request') {
      const list = waiting.byParent.get(span.parentId) ?? [];
      list.push({ span, since: now });
      waiting.byParent.set(span.parentId, list);
      waiting.count += 1;
      if (waiting.count > MAX_WAITING) {
        // Too many wait: export the oldest, which are first in insertion order.
        sweep(
          waiting,
          now,
          -1,
          (orphan) => {
            exportTree(loaded, tracer, orphan, waiting, undefined);
          },
          waiting.count - MAX_WAITING,
        );
      }
      return;
    }
    exportTree(loaded, tracer, span, waiting, undefined);
  };
}

async function loadApi(api: OtelApi | undefined): Promise<OtelApi | Error> {
  if (api) {
    return api;
  }
  try {
    return await import('@opentelemetry/api');
  } catch {
    return new Error(
      "brumate/otel needs the package '@opentelemetry/api'. Install it with `npm install @opentelemetry/api`, or pass it as the `api` option.",
    );
  }
}

/**
 * Exports the spans that waited longer than `age`, as roots, at most `limit` of them. Groups are
 * in insertion order, so the oldest go first.
 */
function sweep(
  queue: Queue,
  now: number,
  age: number,
  onOrphan: (span: TraceSpan) => void,
  limit = Infinity,
): void {
  let left = limit;
  for (const [parentId, list] of queue.byParent) {
    if (left <= 0) {
      return;
    }
    const kept: Waiting[] = [];
    const expired: TraceSpan[] = [];
    for (const item of list) {
      if (left > 0 && now - item.since > age) {
        expired.push(item.span);
        left -= 1;
      } else {
        kept.push(item);
      }
    }
    if (expired.length === 0) {
      continue;
    }
    queue.count -= expired.length;
    if (kept.length === 0) {
      queue.byParent.delete(parentId);
    } else {
      queue.byParent.set(parentId, kept);
    }
    for (const span of expired) {
      onOrphan(span);
    }
  }
}

function exportTree(
  api: OtelApi,
  tracer: Api.Tracer,
  span: TraceSpan,
  waiting: Queue,
  parent: Api.Span | undefined,
): void {
  // A root of ours has the traceparent's parent, which the app does not export.
  let context = api.ROOT_CONTEXT;
  if (parent) {
    context = api.trace.setSpan(context, parent);
  } else if (span.parentId !== undefined) {
    context = api.trace.setSpanContext(context, {
      traceId: span.traceId,
      spanId: span.parentId,
      traceFlags: api.TraceFlags.SAMPLED,
      isRemote: true,
    });
  }
  const made = tracer.startSpan(
    span.name,
    {
      kind: getKind(api, span),
      startTime: span.start,
      attributes: {
        ...span.attributes,
        'brumate.label': span.label,
        'brumate.trace_id': span.traceId,
        'brumate.span_id': span.spanId,
        ...(span.parentId === undefined ? {} : { 'brumate.parent_id': span.parentId }),
      },
    },
    context,
  );
  if (span.status === 'error') {
    const message = span.error?.message ?? '';
    made.recordException({ name: 'Error', message }, span.end);
    made.setStatus({ code: api.SpanStatusCode.ERROR, message });
  }
  made.end(span.end);
  const children = waiting.byParent.get(span.spanId);
  if (!children) {
    return;
  }
  waiting.byParent.delete(span.spanId);
  waiting.count -= children.length;
  for (const child of children) {
    exportTree(api, tracer, child.span, waiting, made);
  }
}

function getKind(api: OtelApi, span: TraceSpan): Api.SpanKind {
  if (span.name === 'brumate.request') {
    return api.SpanKind.SERVER;
  }
  if (span.name === 'brumate.fetch' || span.name === 'brumate.navigation') {
    return api.SpanKind.CLIENT;
  }
  return api.SpanKind.INTERNAL;
}
