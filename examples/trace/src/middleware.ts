import type { TraceSpan } from 'brumate/server';

// The e2e suite reads the spans of the server from here, as it runs this build in its own process.
export function onTrace(span: TraceSpan): void {
  ((globalThis as { serverSpans?: TraceSpan[] }).serverSpans ??= []).push(span);
}
