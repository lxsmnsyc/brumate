// The loader with `onTrace`. The e2e suite reads the spans from `window.spans`.
import type { TraceSpan } from 'brumate/client';
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

const spans: TraceSpan[] = [];
(window as unknown as { spans: TraceSpan[] }).spans = spans;

start({
  load,
  onTrace(span) {
    spans.push(span);
  },
});
