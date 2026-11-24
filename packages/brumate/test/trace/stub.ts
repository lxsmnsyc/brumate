import type { TraceHandler, TraceName, TraceSpan } from '../../src/runtime/trace.ts';

export interface SpanStub {
  /** The spans in the order they ended. */
  spans: TraceSpan[];
  onTrace: TraceHandler;
  /** The spans with a name. */
  named(name: TraceName): TraceSpan[];
}

/** A handler that collects spans, for tests of the adapter and the browser. */
export function stubSpans(): SpanStub {
  const spans: TraceSpan[] = [];
  return {
    spans,
    onTrace(span) {
      spans.push(span);
    },
    named(name) {
      return spans.filter((span) => span.name === name);
    },
  };
}
