---
id: observability-core
title: onTrace on the server, span names and the trace-span contract
status: done
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
verify: pnpm --filter brumate exec vitest run test/trace
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent: 245000
owns:
  - packages/brumate/src/runtime/trace.ts
  - packages/brumate/test/trace/**
shared:
  - packages/brumate/src/runtime/request.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/devtools.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/package.json
  - .changeset/*.md
reserves: []
provides:
  - trace-span
depends_on: []
---

# onTrace on the server, span names and the trace-span contract

## Goal

The server calls `onTrace(span)` for each request, render, memo load, server function call and `#loading` or `#defer` body, with the names and shape of [`trace-span`](../../contracts/trace-span.md), and reads an incoming `traceparent`. It does nothing, and costs nothing, when no `onTrace` is set. This node freezes the contract.

## Current state

- `RequestEvent.traced(kind, label)` makes a `TraceEntry` only in dev and returns the shared `noTrace` otherwise (`packages/brumate/src/runtime/request.ts:193-196`). `TraceEntry` kinds are `render | stream | memo | call | body` (`request.ts:86-92`).
- Call sites: render and stream (`server.ts:4255`, `4307`), memo load (`server.ts:1517`), `#loading` body (`server.ts:1406`), server function called in a render (`request.ts:459`). The dev trace is written into the page as `<script b-trace>` (`server.ts:4318-4328`) and read by the Server tab.
- A server function call from the browser (`handleRequest`, `server.ts:3815`, `x-brumate-args` at `3707`) has no entry: the dev recorder hooks it with `CALL_HOOK` (`request.ts:434-448`, `devtools-calls.ts:191-197`).
- Errors reach `onError` through `logError` (`server.ts:3494`); `onError` comes from `src/middleware.ts` (`vite.ts:1233-1247`, option at `server.ts:3748`).
- No `traceparent` is read anywhere.

## Prior art

See the table in [observability](../observability/brief.md). The choices this node makes: a finished span, as the proposal says "receives the time of each"; `onTrace` as a `src/middleware.ts` export, as `onError` is; a `brumate.*` prefix as SvelteKit and Next.js prefix theirs; `traceparent` read by hand, since the format is one regular expression and OpenTelemetry's propagator ([W3CTraceContextPropagator.ts](https://github.com/open-telemetry/opentelemetry-js/blob/9c03ff81645476520e362a9cf2da24ef0f072e55/packages/opentelemetry-core/src/trace/W3CTraceContextPropagator.ts)) needs the API package.

## Acceptance

- [ ] `trace.ts` exports `TraceSpan`, `TraceHandler`, `TraceName` as in the contract, and a function `startSpan(event, name, label)` that returns an `end(failed?)`. `RequestEvent.traced` calls it, so the dev trace and `onTrace` read the same spans.
- [ ] `src/middleware.ts` may export `onTrace`; the Vite plugin passes it as `onTrace` of `handleRequest` and `RenderOptions` (as `onError`). A render without a request (`RenderOptions.onTrace`) works too.
- [ ] Tests (`packages/brumate/test/trace/`): a page render gives `brumate.request` with child `brumate.render`; a page with a memo gives `brumate.memo`; a server function called in a render gives `brumate.call`; a `#loading` and a `#defer` body give `brumate.body`; a call from the browser gives `brumate.request` with `brumate.kind=call` and `brumate.call`; a form post gives `kind=form`.
- [ ] Parents: every span's `parentId` is its parent's `spanId`, all share one `traceId`.
- [ ] `traceparent`: a valid header sets `traceId` and the root's `parentId`; an invalid one is ignored.
- [ ] Errors: a render that throws gives `status: 'error'` and the message, and `onError` still runs. A `ServerError` answer is `ok`. An `onTrace` that throws or rejects does not change the answer and is logged.
- [ ] Privacy: a test with a cookie, an `authorization` header, a query string and call arguments shows none of them in any span.
- [ ] Off: with no `onTrace` and not in dev, `traced()` makes no object (a test counts calls to the span maker, 0). Report the gzip size of todos (`pnpm bench --only brumate --scenario todos`); the browser bundle changes by 0 bytes because the code is server only (`pnpm build` and compare `dist/` client files).
- [ ] The Server tab of the devtools shows the same entries as before (`packages/brumate/test/devtools-panel/**` passes unchanged).
- [ ] The contract `trace-span` goes to `status: frozen`, version 2 if a name changed.
- [ ] A minor changeset (a new export of `src/middleware.ts` and `handleRequest` option).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: server only, but it touches the render, the call path, errors and the dev trace, in the two largest files (`server.ts`, `request.ts`) that other nodes edit.

## Bytes

A page that does not use it: 0 (server code only). A page that uses it: 0, since the browser has no change in this node.

## Notes for the worker

- Make spans in one function. Do not add a second timer next to `traced`.
- `performance.timeOrigin + performance.now()` for times, so spans from the two sides line up.
- Keep span creation lazy: no `Math.random` or object before a check that `onTrace` is set or the dev trace is on.
- Edit `server.ts` in small hunks; other nodes of 0.9.0 edit it too.
