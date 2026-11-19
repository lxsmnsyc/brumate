# Log: observability-otel

- Read the SDK source (`@opentelemetry/api` 1.10.0, `sdk-trace-base` 2.12.1). `startSpan` takes `startTime` as epoch milliseconds (a number above half of `performance.timeOrigin`), and `end(endTime)` the same.
- The SDK's `IdGenerator` is the app's, so the adapter cannot set span ids. A new trace gets an SDK trace id; the tree is kept by exporting top-down.
- Spans arrive child first, so a child waits in a map keyed by its `parentId` until the parent ends. The parent is exported first (made and ended with its times), then its waiting children with `trace.setSpan(ROOT_CONTEXT, parent)`. This gives real parent ids, with no 60 s id map.
- A root is a span with no `parentId`, or a `brumate.request` (its `parentId` is from an incoming `traceparent`, set as a remote `SpanContext`). A waiting span older than 60 s is exported as an orphan on the next call; no timer.
- `otel()` starts `import('@opentelemetry/api')` at once. The handler awaits it; a failed import throws the install message at the first span only, later spans return.
- Missing package test uses `vi.mock` in its own file.
