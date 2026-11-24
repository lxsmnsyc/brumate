---
'brumate': minor
---

- `start` of `brumate/loader` and `brumate/static-loader` takes `onTrace`.
- `onTrace` gets a span for each event (`brumate.event`), the code a handler waited for (`brumate.load`), the handler run (`brumate.run`), each server function call (`brumate.fetch`) and each navigation (`brumate.navigation`).
- The spans of one event share a trace.
- A call or a navigation to the same origin sends a `traceparent` header, so the server spans join the trace. A request to another origin sends no header.
- Spans carry no arguments, results, query strings or form values.
- A call or a navigation joins the trace of its handler only when the handler makes it before its first `await`. A later call starts a trace of its own.
- A page with `onTrace` does not load linked pages early, so each navigation sends the header.
- A navigation span has its route pattern, such as `/items/[id]`, once the page arrives, and no path when it fails.
- A client build whose entry does not pass `onTrace` ships none of this code.
- The new `trace` option of the Vite plugin (`true`, `false` or `'auto'`) turns tracing on or off when the client entry is elsewhere.
