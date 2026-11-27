# Outcome: stop-ends-loads

## Built

- `stops` and `endLoads()` in `packages/brumate/src/runtime/client/code.ts`. `dispose()` in `resume.ts` bumps the counter through `endLoads()`. `leaveRoutes()` now calls a private `pause()` and does not bump it, so a kept layout still loading its code keeps its `$store` links.
- The continuations in `context.ts` (`resumeStoreReads`), `branches.ts`, `errors.ts` and `insert.ts` (`refresh`) return when `stops` changed since they started.
- A regression test in `packages/brumate/test/module-signals.test.ts`: "links nothing from code that loads after the loader stopped".
- A patch changeset `.changeset/stop-ends-loads.md`.

## Proof

- base: fea5761e. `npx vitest run test/module-signals.test.ts` in `packages/brumate` with the regression test: fails, `expected 1 to be +0`. With the cross-test repro (`RC_SLOW='resumes without a second load' npx vitest run test/module-signals.test.ts -t "an async memo of a module"`): 5 of 5 red.
- branch: regression test passes, module-signals 61 of 61. The repro loop: 4 of 5 green in the first loop (one red in run 1, cause not captured), then 6 of 6 green in a second loop.

## Deviations

- The repro loop was not 5 of 5 on its first try (4 of 5); see Gotchas.
- `leavePage()` also ends the loads, as it calls `dispose()`. Its old scopes are dropped anyway.

## Stubs left

- None.

## Gotchas

- The one red run of the first loop was not captured. A later 6 of 6 loop was green.
- The test "a date that changed on the server loads once in the browser" passed in all loops.

## Proposed learnings

- A continuation of a code load in the client core checks `stops` from `code.ts` before it links or starts anything | a load can outlive `stop()` | `packages/brumate/src/runtime/client` | yes (a load held until after the stop)

## Verification

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run test/resume.test.ts test/differential` and `test/module-signals.test.ts` in `packages/brumate`: pass.
- `node e2e/run.mjs`: all suites pass.

## Size

- Estimated S, actual S.
- Risk estimated medium, measured medium: `dispose()` is on the stop path of every page.
