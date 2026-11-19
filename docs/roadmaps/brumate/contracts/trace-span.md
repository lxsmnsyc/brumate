---
name: trace-span
version: 1
status: frozen
defined_by: observability-core
---

# Contract: trace-span

## Purpose

The shape of a span that `onTrace` receives on the server and in the browser, and the span names. `observability-core` makes it on the server and freezes it. `observability-otel` turns it into OpenTelemetry spans. `observability-browser` makes the browser spans and sends `traceparent`. The Server tab of the devtools reads the same spans.

## Interface

In `packages/brumate/src/runtime/trace.ts`, exported as types from `brumate/server` and `brumate/client`.

```ts
type TraceName =
  | 'brumate.request'    // a request the server handled (page, call, form, endpoint)
  | 'brumate.render'     // the render of a page
  | 'brumate.stream'     // the rest of the page, after the first bytes
  | 'brumate.memo'       // a server memo that loaded
  | 'brumate.call'       // a server function that ran on the server
  | 'brumate.body'       // a `#loading` or `#defer` body
  | 'brumate.event'      // browser: an event, from the event to the end of its handler
  | 'brumate.load'       // browser: the code a handler needed, loaded
  | 'brumate.run'        // browser: the handler itself
  | 'brumate.navigation' // browser: a navigation, from the request to the DOM update
  | 'brumate.fetch';     // browser: a server function call, as the browser sees it

interface TraceSpan {
  name: TraceName;
  /** The component, function, route or event it is about, such as `GET /todos`, `Todos#add`, `click`. */
  label: string;
  traceId: string;       // 32 hex characters
  spanId: string;        // 16 hex characters
  parentId?: string;     // spanId of the parent; for a root, the `parent-id` of an incoming `traceparent`, if any
  start: number;         // epoch milliseconds, with a fraction
  end: number;           // epoch milliseconds, with a fraction
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  error?: { message: string }; // when status is 'error'; no stack
}

type TraceHandler = (span: TraceSpan) => void | Promise<void>;
```

## Behavior

- A span is handed over once, when it ends. The order is the order of ending, so a child comes before its parent.
- `onTrace` is called outside the work it times. A throw or a rejection is logged with `console.error` and does not change the answer; it is not given to `onError`.
- `brumate.request` is the root of a request. Its attributes: `http.method`, `http.route`, `http.status_code`, `brumate.kind` (`page`, `call`, `form`, `endpoint`, `defer`).
- `traceparent` of the request (W3C trace context, `00-<traceId>-<parentId>-<flags>`) sets `traceId` and `parentId` of the root. A bad header is ignored and a new `traceId` is made.
- Attributes never hold arguments, results, cookies, headers or the query string. `label` of a route is the route pattern, not the URL.
- A `ServerError` (an answer, not a fault) gives `status: 'ok'`.
- Times use `performance.timeOrigin + performance.now()`.

## Stub

`stubSpans()` in `packages/brumate/test/trace/stub.ts`: a handler that collects spans for tests of the adapter and the browser.

## Contract tests

`packages/brumate/test/trace/shape.test.ts`.

## Changes

- v1: draft, written when the story was refined (2026-11-18). `observability-core` may change names while it builds, and freezes it with a version bump.
