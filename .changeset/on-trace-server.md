---
'brumate': minor
---

`src/middleware.ts` can export `onTrace`, which gets a span for each request, render, memo load, server function call and `#loading` or `#defer` body of the server, with the names and shape of `TraceSpan` (`brumate.request`, `brumate.render` and so on, exported as types from `brumate/server`). The server reads an incoming `traceparent` header. `handleRequest`, `handleRoute` and `render` take `onTrace` as an option. Without it, the server makes no span.
