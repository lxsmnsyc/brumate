# Outcome: resume-test-races

## Built

- `load` in `packages/brumate/src/runtime/bundles.ts` rejects with the import error when a bundle that the records named failed and the component is not in another bundle. A `failed` map keeps the error after the URL leaves `pending`. A component with no named bundle still resolves to undefined.
- Tests in `packages/brumate/test/resume.test.ts` (`failingHandlers` got a `missingBundle` flag that uses the real `load`): "loads the page again when the bundle that the server names is gone" (one reload, `brumate:skew` code, no second reload for the same build) and "reports a bundle that is gone when the build is the same".
- Changeset `.changeset/bundle-load-fails.md` (patch, brumate).

## Proof

- base: 873c81f4, `pnpm exec vitest run test/resume.test.ts -t "bundle that the server names|bundle that is gone"` with the old bundles.ts: 2 failed (time out), the click throws "handler is not a function", no reload, the import error is not reported.
- branch: same command: 2 passed.

## Deviations

- None. The old flaky tests were already fixed (see the brief); none showed in my runs.

## Stubs left

- None.

## Gotchas

- A failed bundle leaves `pending` as soon as it rejects, so `load` cannot read the failure from `pending`. Use `failed`.
- `load` rejects for any component that is not loaded when some bundle failed, even a component that no bundle holds. A handler always has client code, so this only matters for code that calls `load` on a component with none.

## Proposed learnings

- A test of a load path must not stub the function it covers | the stubbed skew tests passed while the real `load` hid the failure | packages/brumate/test | no

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `vitest run test/resume.test.ts test/bundle-urls.test.ts test/skew.test.ts`: 676 passed.
- `pnpm test` in packages/brumate: 3263 passed, 3 timeouts under load (project.test.ts x2, resume.test.ts "stops updates that keep writing what they read"); the three pass alone.
- `node e2e/run.mjs --only website,browser-async`: website 75 passed, browser-async 6 passed.

## Size

- Estimated S, actual S.

- A failed URL stays in `failed` until a new record (a navigation or a `#defer` body) names it and its import succeeds; nothing retries it on its own (fresh review).
