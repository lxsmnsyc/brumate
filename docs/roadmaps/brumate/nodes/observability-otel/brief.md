---
id: observability-otel
title: brumate/otel: onTrace as OpenTelemetry spans
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
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/trace-otel
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent: 241000
owns:
  - packages/brumate/src/runtime/otel.ts
  - packages/brumate/test/trace-otel/**
shared:
  - packages/brumate/package.json
  - packages/brumate/tsdown.config.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: observability-core
    kind: contract
    via: trace-span
---

# brumate/otel: onTrace as OpenTelemetry spans

## Goal

`import { otel } from 'brumate/otel'` returns a `TraceHandler` that makes an OpenTelemetry span for each brumate span, with the same ids, times, attributes and status. The core does not import it, and `@opentelemetry/api` is an optional peer dependency.

```ts
// src/middleware.ts
import { otel } from 'brumate/otel';
export const onTrace = otel({ tracerName: 'brumate' });
```

## Current state

Nothing exists. The package exports are listed in `packages/brumate/package.json:30-130` (one entry for each subpath, built from `src/runtime/*`).

## Prior art

| Choice                                  | Who                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Brumate                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API is a peer, the SDK is the app's | OpenTelemetry JS: `@opentelemetry/api` is the stable interface, the SDK registers a provider ([tracer.ts at 9c03ff8](https://github.com/open-telemetry/opentelemetry-js/blob/9c03ff81645476520e362a9cf2da24ef0f072e55/api/src/trace/tracer.ts)); SvelteKit loads it with `import('@opentelemetry/api')` and throws a clear error when it is missing ([telemetry.js at 1bd5652](https://github.com/sveltejs/kit/blob/1bd56525a5409fab4153196f026cf85ef620e3b2/packages/kit/src/exports/internal/server/telemetry.js)) | Same: `otel()` takes `api` as an option, or does a dynamic `import('@opentelemetry/api')` and throws a message that names the package if it is missing. Peer dependency with `peerDependenciesMeta.optional`.                                                                                                                                                                                      |
| Starting a span with a past time        | `tracer.startSpan(name, { startTime, attributes }, ctx)` and `span.end(endTime)`                                                                                                                                                                                                                                                                                                                                                                                                                                     | The adapter makes the span at the end of the brumate span, with `startTime` and `end(endTime)`. Needed because a brumate span arrives finished.                                                                                                                                                                                                                                                    |
| Parent                                  | A parent is a `Span` in a `Context` (`trace.setSpan`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Spans arrive in end order, child first. The adapter cannot start the child under a parent that does not exist yet, so it sets the ids: it makes a non-recording `SpanContext` for the parent from `traceId` and `parentId` and uses `trace.setSpanContext(ROOT_CONTEXT, ctx)`. The exported span then has the same `traceId` and `parentId` as brumate's, and its own `spanId` is made by the SDK. |
| Status                                  | `setStatus({ code: SpanStatusCode.ERROR })`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `status: 'error'` sets `ERROR` with the message, and `recordException`-style event with `error.message` only                                                                                                                                                                                                                                                                                       |

A limit that the worker must state in the outcome: the SDK makes the span IDs, so a span that brumate named as a parent has a different `spanId` in OpenTelemetry. The adapter keeps a `Map<brumate spanId, SpanContext>` of spans it made in the last 60 seconds, to parent children correctly. If the SDK's id generator cannot take a given id, the map is the way. The worker checks `IdGenerator` support in the pinned SHA and picks the simpler one that keeps the tree correct; the test is the tree, not the id.

## Acceptance

- [ ] `brumate/otel` exports `otel(options?)` and its types; `package.json` has the export, `peerDependencies` and `peerDependenciesMeta` (optional) for `@opentelemetry/api`; `packages/brumate/src/**` outside `otel.ts` has no import of it (a test greps the build output of `dist/runtime/server.js` and `client.js`).
- [ ] A test with `@opentelemetry/sdk-trace-base` and an in-memory exporter (dev dependency): a request with a render, a memo and a call gives the same tree, names, attributes, times and status in the exporter.
- [ ] An error span has `SpanStatusCode.ERROR`; a span of an incoming `traceparent` has the parent of that header.
- [ ] Without `@opentelemetry/api` installed, `otel()` throws once, naming the package and the install command.
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: one file under 100 lines, one test, one export. The draft contract is enough to start; only the final names wait for the core.

## Bytes

A page that does not use it: 0 (a server-only subpath that nothing imports). A page that uses it: 0 in the browser; the server bundle gains the adapter and `@opentelemetry/api`.

## Notes for the worker

- Run the test with the SDK as a dev dependency of `packages/brumate` only.
- Do not add the SDK, an exporter or any instrumentation package; the app owns them.
