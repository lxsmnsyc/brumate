# Outcome: observability-browser

## Built

- `packages/brumate/src/runtime/trace-browser.ts`: spans of the browser as `TraceSpan` of the contract `trace-span` v1. `traceEvent` (`brumate.event`, `brumate.load`, `brumate.run`), `traceRequest` (`brumate.fetch`, `brumate.navigation`, with the `traceparent` header for the same origin), `traceContext`, `setTraceHandler`.
- `runtime/trace-flag.ts`: `TRACE`, from the global `__BRUMATE_TRACE__`. `src/browser-trace.ts` and `src/vite.ts`: the plugin writes it as `true` on the dev server and in a build whose entry passes `onTrace` to the loader, and as `false` in any other build.
- Plugin option `trace: true | false | 'auto'` (default `'auto'`, the scan of `src/`). A build warns when `onTrace` is named in a script that the scan cannot place; the dev server warns once when `onTrace` is set and the flag is off.
- `onTrace` option of `start` (`LoaderOptions`, `brumate/loader` and `brumate/static-loader`). Hooks: `boot.ts` (event span at the listener), `client/handlers.ts` (load, run, call span), `rpc.ts` (header and end of the call), `loader.ts` (navigation span), `navigate.ts` (header, route, end).
- Tests: `packages/brumate/test/trace-browser/` (`shape.test.ts`, `navigation.test.ts`, `build.test.ts`). E2E suite `trace` in `e2e/suites/trace.mjs` on the new example `examples/trace`. Changeset `.changeset/on-trace-browser.md` (minor).

## Proof

Not a fix node.

## Deviations

- Also edited, outside the owned and shared paths: `packages/brumate/src/runtime/loader.ts` (the navigation span), `packages/brumate/src/runtime/trace-flag.ts` and `packages/brumate/src/browser-trace.ts` (new), `e2e/run.mjs` and `e2e/suites/trace.mjs`, the new example `examples/trace`, and `pnpm-lock.yaml` (one importer block).
- The off-test builds a small app, not the website home (minutes per build). It checks that `brumate.event`, `brumate.load`, `brumate.run`, `brumate.fetch`, `traceparent` and `http.route` are not in the output without `onTrace`, and are with it. Bytes against the base come from the todos bench.
- The e2e runs the production build, with the server in the process of the suite, not a dev server. It checks the server `brumate.request` has the `brumate.fetch` and `brumate.navigation` spans as `parentId`.
- The brief folder was not in the branch, so `brief.md` is not touched.

## Stubs left

- None. `observability-otel` turns these spans into OpenTelemetry spans.

## Gotchas

- A lazy chunk (`rpc.ts`, `navigate.ts`) must not import functions of `trace-browser.ts`: the loader chunk would keep them when the flag is off. Make the span in the loader or the core and pass it in.
- Roots of the browser (`brumate.event`, a navigation or call with no running handler) have no `parentId`.
- Attribution rule (fix round 1): a call or a navigation joins the trace of a handler only when it is made before the handler's first `await`. `current` is cleared when the synchronous part returns, so a call after an `await`, from a memo or from a form is the root of a trace of its own. The alternative, carrying the context in the handler's scope, was not chosen: the function the handler calls is a plain function, and a context that outlives the sync part gave the call of handler A to the trace of an overlapping handler B. A missing parent is better than a wrong trace.
- No raw path in a span: a navigation starts as `GET` with no `http.route`. A page with the state of a route sets `GET /items/[id]` and the route; a failed, aborted, replaced or stateless (error page) navigation keeps `GET` and no route. The manifest has no path template in the browser, so none is used.
- A prefetched page (link hover) sends no `traceparent`: the request is made before the click, so it cannot join a trace. Its navigation span still ends, and the server span of the page is a separate trace.
- A request to the same origin that the server redirects to another origin keeps the `traceparent` header (the browser carries it over), so the other origin sees the trace ID.
- A request to another origin (the `rpc` prefix of `start` on another host) sends no header; its span is made.

## Proposed learnings

- Keep code of an optional feature out of lazy chunks that import it by value, and pass an object made in the always-loaded chunk | the exporting chunk keeps functions that a lazy chunk imports, whatever the flag | packages/brumate/src/runtime | yes (a build test that greps the output)

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint has existing warnings only).
- `pnpm --filter brumate exec vitest run test/trace-browser`: 15 of 15 pass.
- `node e2e/run.mjs --only trace`: 5 of 5 pass in Chrome.
- `pnpm build && pnpm test && node e2e/run.mjs`: exit 0 (all e2e suites pass, trace 5 of 5).
- `pnpm bench --only brumate --scenario todos` (benchmark app: `virtual:brumate/start`, no `onTrace`). Base `origin/feat/observability` (dc74e619) and branch: JS before load 5 files, 33.2 kB / 13.8 kB on both. Client JS in dist 8 files: base 84.9 kB / 29.9 kB, branch 85.0 kB / 30.0 kB (rounded). Exact bytes of the files: raw 86953 to 87027 (+74), gzip of the files together 28883 to 28883 (0), gzip file by file 30800 to 30820 (+20). The residue is a few unused arguments in the loader, the core and the rpc.
- With `onTrace` on (test app, all chunks): 31266 to 32422 gzip, +1.15 kB, in the loader and the core (the estimate was 1 to 1.5 kB).

## Size

- Estimated M, actual M. The flag, the chunk residue and the e2e example took the time.

Landed on feat/observability as 4fe89c2c.
