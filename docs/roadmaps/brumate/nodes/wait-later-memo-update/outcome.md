# Outcome: wait-later-memo-update

## Built

- Cause: during the first wait of a scope with two `await $memo`, `scope.s` holds only the slots of the code before the first `await`. A write that the later awaited memo reads reruns that memo. `asyncMemo` keeps the old value, a hole, and `startLoading` triggers its readers, so the text update `$$b.get($$s, 5).name` threw a `TypeError` reported as `brumate:error`.
- Fix (`packages/brumate/src/runtime/client/updates.ts`): `get` throws `NotReady` when update code (`exempt > 0`) reads a slot that is not in `scope.s`, and the queued update (`later` in `queue`) skips a `NotReady` in place of reporting it. The pending state is the hole in the slots; `setSlots` and resumed records write every slot, so only a wait leaves one out. The rest of the render writes the page from the slots. A memo that reads such a slot goes pending and computes in the rest.
- Tests: `packages/brumate/test/resume.test.ts`, `describe('a write during the first of two awaits in a browser render')`, 2 tests: WaitDestr with the prop written before the first load settles (no error, `ada2 ada3 AC2 0`, loads `[1, 2, 2, 3]`), and a plain memo after the awaits that reads the later awaited memo (no error, not left pending, a later write computes it again). Both fail on 2b1d12ca's `updates.ts`.
- Fixtures: `test/render/WaitDerived.brm`, `waitDerivedHost.brm`.

## Deviations

- The guard is in `get` and the update runner, not in `waits.ts`, so it also covers blocks (`b`) and memos that read a slot past the wait. No new state and no hold of writes (P14).
- No changeset: the code is unreleased story code on feat/browser-async (`wait` is not on main), so no released behavior changes.

## Stubs left

- None.

## Gotchas

- `refresh` (insert.ts) runs updates without a try/catch. A non-memo update that read a hole there would now throw `NotReady` out of the refresh. No path leaves a hole outside a waiting scope, and a waiting scope is not in `rendered`.
- `writeSlot` skips a write of `undefined` over a hole, so the slot stays "not reached" until a value lands.

## Proposed learnings

- none

## Verification

- `pnpm install`, `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test`: 67 files, 2098 tests pass. On the first run, "reads a memo created in the browser as pending until its first load lands" failed once under load and passed 3 of 3 alone.
- Review round 1: no blocking, one should-fix (the plain memo test), fixed in 05ca4cfe. Round 2: clean.

## Size

- Todos, `pnpm bench --only brumate --scenario todos`: JS before `load` 32.3 kB raw, 13.5 kB gzip, click checks pass.
- Estimated S, actual S.
