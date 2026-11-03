# Outcome: server-on-error

## Built

- `onError(error, info)` exported from `src/middleware.ts` is called by the server in place of `console.error`. Code: `logError`, `ServerErrorInfo`, `ServerErrorKind`, `ServerErrorHandler` in packages/brumate/src/runtime/server.ts (exported from `brumate/server`); `RequestOptions.onError`; `failures` in request.ts for the `waitUntil` log; `onError` option of `answerCalls` in testing.ts.
- vite.ts and routes.ts import `onError` from the entry middleware when it exports one (server registry, route module, `virtual:brumate/testing`; `visit` uses the route module).
- Kinds: page, endpoint, call (server function calls, form posts, forms posting to a page), defer, stream.
- Test: packages/brumate/test/server-on-error.test.ts, with fixtures test/server-on-error/failing-defer.brm and failing-loading.brm.
- Docs: routing.md (Errors of the server, Errors and 404), reference-routes.md, server-functions.md. Minor changeset .changeset/server-on-error.md. PR #439 (draft, against `next`).

## Deviations

- The handler is carried per request, not in a module variable (review fix): `RequestEvent.errors` (an `ErrorSink` with the handler and the errors it got), `Context.errors` for a render without an event (`RenderOptions.onError`). Types `ServerErrorInfo`, `ServerErrorKind`, `ServerErrorHandler` moved to request.ts and are re-exported from `brumate/server`. Dedupe is per request.
- Small helpers: `Context.requestEvent()` and `Context.errorSink()` (server.ts), `failures` (request.ts) for the `waitUntil` log.
- `info.event` is typed `RequestEvent | undefined`, so the docs example reads `info.event?.request.url`.
- An endpoint error is rethrown. It reaches `onError` when the app has one, and is not logged otherwise (the host logs it, as before).
- The plugin and the route module use `import * as entry` and pass `entry.default` and `entry.onError`, so a file can export only `onError`, or export it under another name. A file without a default export may make a bundler warn about the missing export.

- The two fixtures first sat in test/render, which the differential render test (#437) renders both ways, so it failed on them. They moved to test/server-on-error/, and the differential test is unchanged.

## Stubs left

- None.

## Gotchas

- Dedupe is per request and per error object; thrown primitives are reported each time.
- A `#defer` body error is reported with kind `'defer'` even though it streams.
- Another worker edits server.ts (search-params); the changes here are in the logging places, errorAnswer/safeError area and the two handlers' first lines.

## Proposed learnings

- None.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint warnings are old).
- `pnpm build && pnpm test`: pass (brumate 2163 tests).
- `pnpm --filter website check:samples`: 65 samples, 0 problems.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 13.6 kB gzip, unchanged.

## Size

- Estimated M, actual M.
