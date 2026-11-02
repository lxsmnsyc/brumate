# Outcome: primitive-await-memo

## Built

- `isNeverPromise(declaration)` in packages/brumate/src/codegen/markup.ts. It is true only for a memo of kind `memo` whose expression is a primitive, an array or a function. `settledMemos` and `watchUnreadMemos` use it, so a memo with `await` inside (kind `async-memo`) is always held by `fillSettled` or watched by `unreadMemo`.
- Tests in packages/brumate/test/resume.test.ts, describe "an async memo that gives a string, with await inside, in a browser render", 6 cases. Fixtures in test/render: PrimitiveAwait*.brm and primitiveAwait*.brm.
- The `loading` render snapshot now uses `fillSettled` for its `$memo(`Hello ${await ready}`)`.
- Changeset .changeset/primitive-await-memo.md (patch, brumate).
- PR #424.

## Deviations

- The array case, `$memo([await load()])`, had the same gap through `NEVER_PROMISE`, so the fix and one test cover it too.

## Stubs left

- None.

## Gotchas

- The browser render compiles a memo with `await` at its top level to an async IIFE, so its value is a promise whatever its expression looks like. `$memo(async () => { await x })` stays kind `memo`, because `site.awaits` counts only top-level `await`.

## Proposed learnings

- A check of an expression's shape says nothing about a memo with `await` inside, whose value is the promise of an async function | check the memo kind first | packages/brumate/src/codegen | yes

## Verification

- All 6 cases time out with main's markup.ts and pass with the fix. The reviewer reproduced this.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1395 passed).
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 35.7 kB / 14.9 kB gzip, same as main.
- Review round 1 (fresh agent, pr-review): clean, no blocking findings. One note: a few more bytes per such memo for the `fillSettled` call.

## Size

- Estimated S, actual S.
