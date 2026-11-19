# Outcome: observability-otel

## Built

- `packages/brumate/src/runtime/otel.ts`: `otel(options?)` returning a `TraceHandler`, with `OtelOptions` (`tracerName`, default `brumate`; `api`, the `@opentelemetry/api` module, otherwise imported) and the re-exported `TraceHandler` and `TraceSpan` types. Exported as `brumate/otel` (own entry in `tsdown.config.ts` and `package.json`).
- Each brumate span becomes one OpenTelemetry span: name is `span.name`, attributes are `span.attributes` plus `brumate.label`, start and end times are kept, kind is SERVER for `brumate.request`, CLIENT for `brumate.fetch` and `brumate.navigation`, INTERNAL for the rest. An error span gets `SpanStatusCode.ERROR` with the message and an `exception` event with `exception.message` (no stack).
- `@opentelemetry/api` is an optional peer dependency (`>=1.9`, `peerDependenciesMeta.optional`). Without it, the first span makes the handler throw an error naming the package and `npm install @opentelemetry/api`; later spans return.
- Tests: `packages/brumate/test/trace-otel/otel.test.ts` (SDK with `InMemorySpanExporter`: tree, names, attributes, times, status, `traceparent`, error span, orphan, build output has no `@opentelemetry`) and `missing.test.ts`.
- Changeset `.changeset/otel-adapter.md` (minor).

## Proof

Not a fix node.

## Deviations

- Dev dependencies `@opentelemetry/api` and `@opentelemetry/sdk-trace-base` added to `packages/brumate/package.json`; `pnpm-lock.yaml` updated with pnpm.
- The SDK makes the span ids and the trace id of a new trace, so ids in the exporter differ from the ones `onTrace` gets, as the brief expected. The tree, one trace and the `traceparent` ids (trace id and parent id of the request) are kept. The brief's id map was not needed: children wait for their parent and are exported after it, so parents are real spans.
- A child whose parent never arrives is exported as a root with the brumate parent id after 60 s, on the next span (no timer).

## Stubs left

- None.

## Gotchas

- The handler holds children until the parent ends. A parent that ends after the process stops loses its waiting children.
- Roots are spans with no `parentId` and every `brumate.request`. A browser root with a `parentId` that is not a brumate span (such as `brumate.event`) would wait 60 s for the next span; `observability-browser` should leave `parentId` off its roots, or the root rule changes.
- Waiting spans are checked for age at most every 5 s, on a span (no timer, since `unref` may not exist on a host). At most 10,000 spans wait; past it the oldest are exported as roots. Children of a root that never ends wait until the next span after 60 s, or are lost on shutdown or idle. A request longer than 60 s can split: its late children are exported as roots.
- The contract has no trace flags, so an unsampled incoming `traceparent` is exported as sampled (`TraceFlags.SAMPLED` on the remote parent).
- Every span has `brumate.trace_id`, `brumate.span_id` and `brumate.parent_id` (when set), to match exporter spans with `onTrace` and devtools ids. The SDK's `IdGenerator` makes the real ids and the adapter cannot set them.
- The exception event is stamped with the span's end time.
- The peer range is `>=1.9`; the dev version is 1.10.

## Proposed learnings

- Keep adapters to a peer package in their own entry and test that the server and client builds do not mention it | keeps optional dependencies out of every page | packages/brumate/src/runtime | yes (the build-output test)

## Verification

- `pnpm lint` (existing warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate exec vitest run test/trace-otel test/trace`: 27 of 27 pass (after review round 1).
- `pnpm test` in `packages/brumate`: 110 files, 3337 tests pass. The build-output test skips when `dist/` is absent. e2e not run: the change adds a server-only entry that no page imports; `dist/runtime/server.js` and `client.js` have no `@opentelemetry` text, only `dist/runtime/otel.js` does.

## Size

- Estimated S, actual S. Client bytes: 0.

Landed on feat/observability as 197b2af2.
