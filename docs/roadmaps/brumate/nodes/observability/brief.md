---
id: observability
title: Observability
status: done
priority: must
type: story
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/trace test/trace-otel test/trace-browser
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

> 2026-11-12: a must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md). Refined 2026-11-18 into a story with four children; its one open question is in `questions.md`.

# Observability

## Goal

An app can see where the time of a request goes. `onTrace(span)` receives finished spans on the server and in the browser, an OpenTelemetry adapter turns them into OpenTelemetry spans, and nothing runs or ships when no one sets it. Source: [Observability](../../../../proposals.md#observability).

## Children

| Child                 | Size | What                                                                                                       |
| --------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| observability-core    | M    | `onTrace` on the server, the span shape and names, `traceparent` in, the contract `trace-span`             |
| observability-otel    | S    | `brumate/otel`: `otel()` returns an `onTrace` that makes OpenTelemetry spans                               |
| observability-browser | M    | `onTrace` in the browser: event, module loads, handler run, navigation, server call with `traceparent` out |
| observability-docs    | S    | website page, `decisions.md`, skill note                                                                   |

The core freezes the contract first. The adapter and the browser build on the contract (a `contract` edge), so they start from its draft and run in parallel with the core. The docs wait for all three.

## Decisions (2026-11-18)

- One span shape for both sides, a finished span (`trace-span` contract). It is handed over when it ends, with its start and end time. A handler that needs a live span (to set attributes during the work) is not served: the proposal asks for timings, and a finished span costs one object per span.
- The server registers it with an `onTrace` export of `src/middleware.ts`, beside `onError` (`vite.ts:1233-1247`, `server.ts:3748`), and the `onTrace` option of `handleRequest`. This is the form of `onError`, which the maintainer chose on 2026-11-03. The browser registers it in the start options of `virtual:brumate/start`.
- Off means zero cost. The server checks one field of the request event before it makes a span (`RequestEvent.traced` already returns a shared no-op without a trace, `request.ts:193-196`). The browser guards every call site with a compile-time flag that the Vite plugin defines from the presence of a browser `onTrace`, so a page without it ships no trace code. SvelteKit does the same with `__SVELTEKIT_SERVER_TRACING_ENABLED__`.
- OpenTelemetry stays out of the core. `brumate/otel` is a subpath of the same package with `@opentelemetry/api` as an optional peer dependency, so the core imports nothing of it. Next.js and SvelteKit ship the same split: the API is a peer, the app owns the SDK.
- The dev trace of the Server tab (`TraceEntry`, `request.ts:86`) is a view of the same spans. `observability-core` makes `traced()` the one place that makes spans, so dev and production cannot differ.
- Errors: a span that fails has `status: 'error'` with the message. It does not replace `onError`; both run.
- Not done here: metrics, logs, sampling (the app's `onTrace` decides what to keep), and a hosted exporter.

## Prior art

Read at pinned SHAs. The rows say who does what.

| Choice         | OpenTelemetry JS                                                                                                                                                                                                                  | Next.js                                                                                                                                                                                                                 | SvelteKit                                                                                                                                                                                                                                       | Nitro                                                                                                                                                                                                         | silmaril                                         | Brumate                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registration   | `trace.getTracer(name)` from the API; the SDK is set up by the app ([tracer.ts at 9c03ff8](https://github.com/open-telemetry/opentelemetry-js/blob/9c03ff81645476520e362a9cf2da24ef0f072e55/api/src/trace/tracer.ts))             | `register()` in `instrumentation.ts` at the project root ([instrumentation test app at 7ea5920](https://github.com/vercel/next.js/tree/7ea592082e63e9a2af8ac388d6a24bc4d9373581/test/e2e/instrumentation-hook-src/src)) | `instrumentation.server.js` ([adapter test app at 1bd5652](https://github.com/sveltejs/kit/blob/1bd56525a5409fab4153196f026cf85ef620e3b2/packages/adapter-netlify/test/apps/instrumentation/src/instrumentation.server.js)), run before the app | Build and dev hooks only; no request-time tracing hook at this SHA ([hooks.ts at 749b12b](https://github.com/nitrojs/nitro/blob/749b12bc82dfa75ef99c9a4b0d33b2278d7aa4b8/src/types/hooks.ts) has `dev:error`) | nothing on tracing (checked the tree at 910f4c1) | `onTrace` export of `src/middleware.ts`, like `onError`                                                                                                                        |
| Span API       | `startSpan` and `startActiveSpan`, a live `Span` with `setAttribute`, `setStatus`, `end`                                                                                                                                          | Own tracer wraps the OpenTelemetry tracer ([trace/tracer.ts](https://github.com/vercel/next.js/blob/7ea592082e63e9a2af8ac388d6a24bc4d9373581/packages/next/src/server/lib/trace/tracer.ts))                             | `record_span({ name, attributes, fn })` wraps the work and gives `fn` a span ([telemetry.js](https://github.com/sveltejs/kit/blob/1bd56525a5409fab4153196f026cf85ef620e3b2/packages/kit/src/exports/internal/server/telemetry.js))              | none                                                                                                                                                                                                          | none                                             | A finished span object, no live span (see Decisions)                                                                                                                           |
| Off by default | no-op tracer without an SDK                                                                                                                                                                                                       | spans are no-ops without an SDK                                                                                                                                                                                         | `__SVELTEKIT_SERVER_TRACING_ENABLED__` removes the import when off; `noop_span` otherwise                                                                                                                                                       | n/a                                                                                                                                                                                                           | n/a                                              | Server: no field set, shared no-op. Browser: compile-time flag                                                                                                                 |
| Span names     | free text                                                                                                                                                                                                                         | `BaseServer.render`, `AppRender.getBodyResult` and others in an enum ([constants.ts](https://github.com/vercel/next.js/blob/7ea592082e63e9a2af8ac388d6a24bc4d9373581/packages/next/src/server/lib/trace/constants.ts))  | a `sveltekit.*` prefix (the name is passed to `record_span`; the call sites are in `runtime/server/respond.js`)                                                                                                                                 | n/a                                                                                                                                                                                                           | n/a                                              | `brumate.<part>`: `brumate.request`, `brumate.render`, `brumate.memo`, `brumate.call`, `brumate.body`, `brumate.stream`, `brumate.event`, `brumate.load`, `brumate.navigation` |
| Context in     | W3C `traceparent` via `W3CTraceContextPropagator` ([source](https://github.com/open-telemetry/opentelemetry-js/blob/9c03ff81645476520e362a9cf2da24ef0f072e55/packages/opentelemetry-core/src/trace/W3CTraceContextPropagator.ts)) | through the OpenTelemetry API (`propagation` and `context`), not read line by line                                                                                                                                      | extracts the context from the request and starts the root span in it                                                                                                                                                                            | n/a                                                                                                                                                                                                           | n/a                                              | The core reads `traceparent` into `traceId` and `parentId` and does not depend on OpenTelemetry for it                                                                         |
| Errors         | `recordException`, `setStatus(ERROR)`                                                                                                                                                                                             | same, through the tracer                                                                                                                                                                                                | `known_error` attributes for `HttpError`, `recordException` for 5xx and unknown errors                                                                                                                                                          | none                                                                                                                                                                                                          | n/a                                              | `status: 'error'` and `error.message`; a `ServerError` answer (not a fault) is `ok`                                                                                            |

## Open question

One question, in `questions.md`: whether the browser sends `traceparent` with server calls and navigations. The children are written for the recommended option (send it when the browser has an `onTrace`).

## Sizing

L, three of the four children are M or more and the shape crosses server, browser and errors. Each child is one PR into `feat/observability`; the story PR goes to the maintainer.
