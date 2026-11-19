# Outcome: observability-core

## Built

- `packages/brumate/src/runtime/trace.ts`: `TraceSpan`, `TraceHandler`, `TraceName` as in the contract, `Tracer` (one per request or render), `startSpan(source, name, label)` returning `end(failed?, error?)`, `traceRequest` and `traceResponse`. Types are exported from `brumate/server` and `brumate/client`.
- `RequestEvent.tracer` exists only when `onTrace` is passed. `RequestEvent.traced(kind, label)` calls `startSpan` only then, and still writes the dev `TraceEntry`, so the dev trace and `onTrace` come from the same steps. With neither, `traced()` makes nothing.
- `onTrace` option of `handleRequest`, `handleRoute` (`RouteOptions`) and `render` (`RenderOptions`). The Vite plugin and the route module pass the `onTrace` export of `src/middleware.ts`, as `onError`.
- Spans: `brumate.request` (root; attributes `http.method`, `http.route`, `http.status_code`, `brumate.kind` = page, call, form, endpoint, defer), `brumate.render`, `brumate.stream`, `brumate.memo`, `brumate.call`, `brumate.body` (label `#loading <id>` or `#defer <id>`). The request ends when its response body is read to the end, or its signal aborts. `http.route` is the route pattern (`unmatched` when none); call requests use `<rpc prefix>/<function id>`.
- Parents: render and stream are children of the request; memo, call and body are children of the latest render. All share one `traceId`.
- `traceparent` (`00-<32 hex>-<16 hex>-<2 hex>`, not all zeros) sets `traceId` and the root's `parentId`. An invalid one is ignored.
- Errors: a throw gives `status: 'error'` and `error.message`, no stack. `ServerError` and `Redirect` give `ok` (`request.ts` registers them in `answerErrors`). A throwing or rejecting `onTrace` is logged with `console.error` and changes nothing; it does not reach `onError`.
- Tests in `packages/brumate/test/trace/` (`shape.test.ts`, `stub.ts` with `stubSpans()`, three `.brm` fixtures). Changeset `.changeset/on-trace-server.md` (minor).

## Deviations

- Also edited, outside the owned and shared paths: `packages/brumate/src/routes.ts` (the route module passes `onTrace`), `packages/brumate/src/runtime/route-render.ts` (stream span, failed render), `packages/brumate/src/runtime/client.ts` (type export only), and `packages/brumate/test/server-on-error.test.ts` (one string the generated code now has).
- The brief's `devtools-panel/**` test path does not exist. The devtools tests are `packages/brumate/test/devtools*.test.ts`; they pass unchanged.
- The contract `trace-span` is not edited here. Names and shapes match version 1 unchanged, so it freezes at version 1 (the orchestrator sets `status: frozen` on main).
- A render without a request has no `brumate.request`; its `brumate.render` is the root.

## Stubs left

- None. `observability-browser` makes the browser spans and sends `traceparent`; `observability-otel` turns spans into OpenTelemetry spans.

## Gotchas

- `trace.ts` must not import `request.ts` (oxlint `import/no-cycle`). `request.ts` pushes its error classes into `answerErrors`.
- A `#defer` request renders its body through `Context.register`, which now takes the label `#defer`. Do not add a second span in `renderDeferred`.
- `onTrace` is not given to `waitUntil`; on a host that stops work when the response ends, an async handler can be cut off.
- When the reader cancels, the response stream errors or the request signal aborts, the request span and every span still open (`brumate.stream`, `#loading` and `#defer` bodies) end as `error` with the reason, children first. `Tracer.open` holds them.
- A 5xx answer fails the request span only when a non-answer error failed a span, or when nothing in the request was a `ServerError`. A `ServerError` with 503 is `ok`.
- A response that no route gives (`handleRoute` returns undefined) makes no span.

## Proposed learnings

- Make spans only behind a check that a tracer is set | keeps the off path at zero objects | packages/brumate/src/runtime | yes (the "when off" test spies on `startSpan`)

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint has existing warnings only).
- `pnpm --filter brumate exec vitest run test/trace`: 20 of 20 pass (after review round 1). `test/devtools*`: pass.
- `pnpm build && pnpm test && node e2e/run.mjs`: exit 0 on the last run. An earlier run had a timeout in `resume.test.ts` and one failure in `testing.test.ts`, both under load; they pass alone (670 tests across the three files). One real failure, a string in `server-on-error.test.ts`, was fixed.
- `pnpm bench --only brumate --scenario todos`: JS before load 5 files, 33.2 kB raw / 13.8 kB gzip; client JS in dist 8 files, 84.9 kB / 29.9 kB gzip. No base run for comparison; the code is server only (`brumate.request` appears only in the server chunk of `dist`), so the client change is 0 bytes.

## Size

- Estimated M, actual M.

Merged into feat/observability in #524 (dc74e619).
