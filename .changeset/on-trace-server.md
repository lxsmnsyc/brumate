---
'brumate': minor
---

- `src/middleware.ts` can export `onTrace`. It gets a span for each request, render, memo load, server function call, and `#loading` or `#defer` body on the server.
- Span names and shapes follow the `TraceSpan` types of `brumate/server` (`brumate.request`, `brumate.render` and so on).
- The server reads an incoming `traceparent` header.
- `handleRequest`, `handleRoute` and `render` take `onTrace` as an option.
- Without `onTrace`, the server makes no spans.
