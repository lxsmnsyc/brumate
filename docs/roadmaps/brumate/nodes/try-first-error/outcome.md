# Outcome: try-first-error

## Built

- `catchInto` in packages/brumate/src/runtime/client/errors.ts gets the scope of the `#try` body that failed. `fail` finds it as the scope below the block's holder. After `loadPart(module, 'update')` resolves, `catchInto` drops the error when that body scope left `scopes`. The `#catch` then renders once and shows the first error, as on the server. `onError` still sees every error. `brumate:error` does not fire for a dropped one.
- Test `two errors of one #try body at once` in packages/brumate/test/resume.test.ts, two cases, with fixtures `tryTwoEffects` (from feat/browser-async) and `tryTwoRows` (two `#for` rows whose effects throw in one update).
- Changeset `.changeset/try-first-error.md` (patch).

## Deviations

- The story's check sits in `fail`, before `catchInto`. That does not work on main: main's `catchInto` awaits the update part, so both errors pass the check before the first one replaces the body. On main the check runs inside `catchInto`, after the await. On the story `catchInto` is sync, so either place works there.

## Stubs left

- None.

## Gotchas

- When main syncs into feat/browser-async, keep one check: the story's version in `fail` and this one in `catchInto` will conflict in errors.ts. The check in `catchInto` is correct on both. Drop the story's `.changeset/try-shows-first-error.md`.
- An error whose body was removed for another reason, such as an `#if` that closed, is now dropped too. Before, `catchInto` returned early or replaced a newer body. No test pins this.

## New bugs

- None.

## Verification

- Both tests fail on main (`Error: second 1`, `Error: row 2 1`) and pass with the fix. The reviewer reproduced this in a separate worktree from origin/main and checked that reverting errors.ts fails them again.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1400) pass.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 14.9 kB gzip, same as main; click waits passed.

## Size

- Estimated S, actual S.
