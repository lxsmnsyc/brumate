---
id: observability-browser
title: onTrace in the browser: events, loads, runs, navigations, calls
status: active
priority:
type: feature
story: observability
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/trace-browser
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/src/runtime/trace-browser.ts
  - packages/brumate/test/trace-browser/**
shared:
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/rpc.ts
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/client/code.ts
  - packages/brumate/src/runtime/client/handlers.ts
  - packages/brumate/src/runtime/client/state.ts
  - packages/brumate/src/vite.ts
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: observability-core
    kind: contract
    via: trace-span
---

# onTrace in the browser: events, loads, runs, navigations, calls

## Goal

`onTrace(span)` in the start options of the browser receives, for each event, the time from the event to its end, split into the code that loaded and the run of the handler, so a slow first click shows where its time went. It also receives navigations and the server calls the browser makes, and sends `traceparent` with them so the server spans join the same trace (question 1 of the story, option A). A page without a browser `onTrace` ships none of it.

## Current state

- The loader listens to events on the document in `boot` (`packages/brumate/src/runtime/boot.ts:150-160`, `listen`), loads the core and the module of the handler, and runs it. Module loading is `loadModule` (`runtime/client/code.ts:7-23`); the handler runs in `runtime/client/handlers.ts`.
- A server call is `post` in `runtime/rpc.ts:66-86`; a navigation request is the `fetch` at `runtime/navigate.ts:719` (`navigate`, `703`), with timings already reported through `NavigationReport` (`navigate.ts:699`).
- The devtools time calls with `CallTiming` (`runtime/devtools.ts:83`), dev only.
- Start options are passed by `virtual:brumate/start` (the entry written in `packages/brumate/src/vite.ts`).

## Prior art

| Choice | Who | Brumate |
| --- | --- | --- |
| Span from an event | OpenTelemetry's browser instrumentations (`instrumentation-user-interaction`) wrap `addEventListener` and make a span per event (not part of the API repository; named here for the idea only) | The loader already owns the one listener per event type, so it makes the span there, with no wrapping. |
| Context out | OpenTelemetry fetch instrumentation sets `traceparent` for same-origin requests ([W3CTraceContextPropagator.ts at 9c03ff8](https://github.com/open-telemetry/opentelemetry-js/blob/9c03ff81645476520e362a9cf2da24ef0f072e55/packages/opentelemetry-core/src/trace/W3CTraceContextPropagator.ts) is the format) | Written by hand: `00-<traceId>-<spanId>-01`. Same-origin only; calls to another origin (`origins` option) get no header. |
| Off | SvelteKit removes the tracing import with a compile-time constant when off ([telemetry.js at 1bd5652](https://github.com/sveltejs/kit/blob/1bd56525a5409fab4153196f026cf85ef620e3b2/packages/kit/src/exports/internal/server/telemetry.js)) | A constant `__BRUMATE_TRACE__` that the plugin defines as `true` only when the start options pass `onTrace`. Each call site is `if (__BRUMATE_TRACE__) { … }`, so the bundler removes it. Without the plugin (a test), it is `false`. |
| Names | Next.js, SvelteKit prefix names | `brumate.event`, `brumate.load`, `brumate.run`, `brumate.navigation`, `brumate.fetch` (contract `trace-span`) |

## Acceptance

- [ ] `trace-browser.ts` makes `TraceSpan`s as in the contract, with a `traceId` per user event (a click and everything it started share one) and `brumate.load` and `brumate.run` as children of `brumate.event`. A handler that needs no load gives no `brumate.load`.
- [ ] A click on a handler whose code is not loaded gives `brumate.event` > `brumate.load` + `brumate.run` in the order of the work (e2e in `e2e/`, with Chrome, and a happy-dom test for the shape).
- [ ] A handler that calls a server function gives `brumate.fetch` as a child of the run, and the request carries `traceparent` with that span's ID. Against a dev server with `observability-core`, the server `brumate.request` has that `parentId` (e2e).
- [ ] A navigation gives `brumate.navigation` with `http.route` and the status, and sends `traceparent`.
- [ ] No arguments, results, URLs with a query string, form values or text are in attributes. `label` of an event is the event type and the handler's component, such as `click Todos#add`.
- [ ] An error in the handler gives `status: 'error'` with the message, and the page's error path (`fail`, `errors.ts`) runs as before. A throw in `onTrace` is logged and ignored.
- [ ] Off: a build without `onTrace` has no `trace-browser` code. A test builds the website home with and without and compares: the file list and bytes are the same as before this node (0 bytes), and `rpc.ts`, `boot.ts`, `navigate.ts` have no span code in the minified output (a grep for `brumate.event`). Report the bytes with it on (gzip of the loader and the core) and the gzip size of todos (`pnpm bench --only brumate --scenario todos`).
- [ ] A minor changeset (a new start option).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`, then `node e2e/run.mjs` for the cases above.

## Sizing

M: browser only, but it edits the loader, the client core, the rpc and the navigation, with errors and a build flag; the e2e needs a dev server and a browser.

## Bytes

A page that does not use it: 0, by the build constant. A page that uses it: recorded, an estimate of 1 to 1.5 kB gzip across the loader and the core (to replace with the measurement). Size is recorded, not a gate.

## Notes for the worker

- Time with `performance.timeOrigin + performance.now()` and take the start at the listener, before the module loads.
- The loader is the smallest file of the page: put the event span in `trace-browser.ts`, and let the loader call it behind the constant.
- If question 1 is answered B, drop the header and the server-side join test; the rest stays.
- Edit `boot.ts`, `rpc.ts` and `navigate.ts` in small hunks; other nodes edit them too.
