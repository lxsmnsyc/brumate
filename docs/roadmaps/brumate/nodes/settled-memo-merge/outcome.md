# Outcome: settled-memo-merge

## Built

- Sync of origin/next (main at 0.4.2) into feat/browser-async, merge 16ca9da1. Conflicts in markup.ts (statement loop and methods) and resume.test.ts (two describes at one place) kept both sides.
- `fillSettled(id, values, write)` moved from packages/brumate/src/runtime/client/templates.ts to packages/brumate/src/runtime/client/waits.ts, still exported from `brumate/client`. With a promise among `values` it counts in the boundary of the render with `join`, ends with `leave` after the write (also when the write throws) or when its scope goes, and with `fail` then `fault` on a rejection. The templates.ts copy (50 lines) and its imports of `fail` and `isThenable` are gone.
- `Emitter.settledMemos` (packages/brumate/src/codegen/markup.ts) skips a memo that the component awaits, in the render module (`waits`). `wait` already gives the rest its settled value, so the `fillSettled` call for it was a second wait on the same memo.
- Tests in packages/brumate/test/resume.test.ts, in "await $memo in a component that the browser renders": a constant awaited memo with a held constant memo next to it (fixtures WaitConst.brm, waitConstHost.brm), and two boundary tests for `fillSettled` (count, write, scope gone, rejection with `f`; a write that throws; one rejection reported once with two count-downs).
- contracts/client-pending-boundary.change-request.md: waits.ts now exports `fillSettled` too.

## Deviations

- The brief asks for one mechanism with the other's runtime exports and codegen gone. Neither can replace the other without breaking tested behavior. `wait` splits only the instance script, holds the whole rest and runs `setSlots`, while #419/#421 hold only the writes that read a memo, also in block scripts and rows. `fillSettled` has no range, no slots and no latest-load rule, which `wait` needs for a prop that changes during the wait. So what is one now is the boundary counter and the module: both waits count with `join`/`leave`/`fault`, and no memo is waited for by both. The `fillSettled` export and `settledMemos` stay; the waiting itself is still two ways (`until` on slots, `Promise.all` with a scope check). Deleting the second way needs values-build.

## Stubs left

- None.

## Gotchas

- A held write in a body that a boundary renders now keeps the boundary open until its memos settle. Only tests call `bound` today, so no page changes; browser-loading-fallback gets the right count for held writes.
- Contract tests that import src/runtime/client modules see `options` undefined unless they call `configure`; `fail` reads `options.onError`.
- `fault` runs once per wait, also for a rejection that `fail` reported only once (dedupe by error and scope).

## Proposed learnings

- A wait of a browser render, whatever writes it, counts in the boundary with join, leave and fault | otherwise a #loading fallback leaves before held markup is written | packages/brumate/src/runtime/client | yes

## Verification

- `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` 1968 passed. The #419, #421 and browser-await describes all pass.
- With the codegen skip disabled, the constant-await test fails on the render module check. The boundary tests fail before the change (no `fillSettled` in waits.ts, no count).
- Review round 1: no blocking, two non-blocking fixed. Round 2: clean, one nit fixed (spy restore).

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`: before 32,890 B raw / 13,858 B gzip (16ca9da1), after 32,890 B / 13,861 B.
- Estimated M, actual S/M.
