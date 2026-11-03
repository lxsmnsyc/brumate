# Outcome: server-on-error

## Built

- `onError(error, info)` exported from `src/middleware.ts` is called by the server in place of `console.error`. Code: `logError`, `ServerErrorInfo`, `ServerErrorKind`, `ServerErrorHandler` in packages/brumate/src/runtime/server.ts (exported from `brumate/server`); `RequestOptions.onError`; `failures` in request.ts for the `waitUntil` log; `onError` option of `answerCalls` in testing.ts.
- vite.ts and routes.ts import `onError` from the entry middleware when it exports one (server registry, route module, `virtual:brumate/testing`; `visit` uses the route module).
- Kinds: page, endpoint, call (server function calls, form posts, forms posting to a page), defer, stream.
- Test: packages/brumate/test/server-on-error.test.ts, with fixtures test/render/failing-defer.brm and failing-loading.brm.
- Docs: routing.md (Errors of the server, Errors and 404), reference-routes.md, server-functions.md. Minor changeset .changeset/server-on-error.md. PR #439 (draft, against `next`).

## Deviations

- Added `Context.requestEvent()` (server.ts) and `failures` (request.ts), small helpers so the error places reach the event.
- `info.event` is typed `RequestEvent | undefined` (a nested `#defer` fetch in fillHoles has none), so the brief's example reads `info.event?.request.url` in the docs.
- An endpoint error is reported and rethrown, so the host still sees it.
- The default export of `src/middleware.ts` is required with `onError`, since the plugin imports it.

## Stubs left

- None.

## Gotchas

- The hook is a module variable set per request: one app per process. Dedupe is per error object (WeakSet), forever, so a test must throw a fresh error each time.
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
