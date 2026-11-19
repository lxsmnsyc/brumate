# Log: observability-core

## 2026-11-19

- The worktree has no brief or `contracts/trace-span.md` (they are on main only). Read them from the main checkout. The contract is left as it is: no name or shape changed, so it freezes at version 1. The orchestrator sets `status: frozen` on main.
- `trace.ts` holds the types, `Tracer` (one per request or render), `startSpan`, `traceRequest` and `traceResponse`. `RequestEvent.traced` calls `startSpan` only when `tracer` is set, and keeps writing the dev `TraceEntry`, so the Server tab reads what it read before.
- `trace.ts` imports nothing from `request.ts` (oxlint `import/no-cycle`). `request.ts` registers `ServerError` and `Redirect` in `answerErrors`, which makes them `ok` spans.
- A `#defer` body is made by `deferBlock`, which went through `register` with the label `#loading`. It now passes `#defer`, so a `#defer` request gives one `brumate.body` with the right label (a second span in `renderDeferred` would have doubled it).
- The request span ends when the response body is read to the end, or when the request's signal aborts. A request with no body ends at once. A response that no route gives (`handleRoute` returns undefined) makes no span.
- A render with no event gets its own `brumate.render` in `render()`. A render with an event gets it from `renderPage`.
- Passing `onTrace` into the generated entries in `routes.ts` and `vite.ts` (four places).
