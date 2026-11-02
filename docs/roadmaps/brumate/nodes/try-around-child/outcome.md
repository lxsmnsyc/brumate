# Outcome: try-around-child

## Built

- `tryCatchesClient` in packages/brumate/src/graph.ts returns true when the `#try` body holds a component or a dynamic tag.
- packages/brumate/src/plan.ts gives the `#try` body scope an ID when `tryCatchesClient` holds, so a child's scope links to it and `fail` finds the `t` entry.
- `getChildren` and `forEachNode` moved from project.ts to ast.ts (project.ts re-exports them) to avoid an import cycle.
- Tests in packages/brumate/test/resume.test.ts, describe "a #try around a child component": 5 fixtures (sibling control, child alone, grandchild, child in `#if`, child in `#for`) by 3 errors (handler, async handler, effect). Fixtures TryKid.brm, TryMiddle.brm, tryAroundChild*.brm, tryAroundGrandchild.brm.
- unreadMemoTry.brm: the show button moved out of the `#try`; the workaround is no longer needed.
- Changeset .changeset/try-around-child.md (patch, brumate).

## Deviations

- The reported cause was half of it. The missing body scope ID was the other half.

## Stubs left

- None.

## Gotchas

- A `#template` inside a `#try` does not catch client errors, even with a plain button in the template. On main. Found in review, not fixed here.
- The rule counts any component in the body, including in nested `#catch`, `#client` or `#defer` bodies. A precise rule needs the child's graph across files.

## Proposed learnings

- A `#try` catches by scope kinds, so its body scope needs an ID whenever it catches | a child's scope otherwise skips it | packages/brumate/src/plan.ts | yes

## Verification

- On main 12 of the 15 new tests and the unreadMemoTry test fail; all pass with the fix.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1326 passed).
- `pnpm bench --only brumate --scenario todos`: JS before `load` 14.8 kB gzip, the same as main.

## Size

- Estimated S, actual S.
