# Outcome: late-state-record

## Built

- The state record of a streamed slot (`packages/brumate/src/runtime/client/resume.ts`) writes its result only when the slot still holds the server promise and `loads` has no entry for the memo, so a record that arrives after the memo loaded again does not replace the newer load.
- Tests in `packages/brumate/test/resume.test.ts`: the record arrives before the newer load settles (fails on main: the slot becomes the old result), and the newer load settled first (passes on main, kept as a guard).
- Changeset: brumate patch.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- `loads` keeps the entry after a load settles, so a record is also dropped after the newer load settled. The slot no longer holds the promise then, so the result is the same.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts -t "newer load"`: the first test fails on main, passes with the fix.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: see the PR.

## Size

- Estimated S, actual S.
