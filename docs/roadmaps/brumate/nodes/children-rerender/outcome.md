# Outcome: children-rerender

## Built

- Already fulfilled by #281 (spread-children-live) and rest-ref-local-error. The guard test is `keeps the nodes and the focus of the rows that spread onto a TreeItem when rows open and close` in packages/ui/test/navigation-tree.test.ts.

## Proof

- base: batch/brumate-main, `pnpm --filter @brumate/ui exec vitest run test/navigation-tree.test.ts test/tree.test.ts`: the new test passes without a code change (13 tests pass).
- branch: same command, same result. The test mounts the page twice in one core, keeps the link, row and chevron elements, opens and closes a sibling row, a nested row and the row itself, and expects the same nodes and `document.activeElement`.

## Deviations

- None. No code change and no changeset.

## Stubs left

- None.

## Gotchas

- A press on a chevron keeps focus on the row, not on the chevron. A test of focus there expects the row.

## Proposed learnings

- None.

## Verification

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter @brumate/ui test --maxWorkers=2`: pass (exit 0).

## Size

- Estimated S, actual S.
