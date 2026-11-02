# Log: try-around-child

- 2026-11-02: Branch fix/try-around-child from origin/main 1b6693eb. Took the try-around-child tests from the proof patch, renamed the fixtures (TryKid.brm, tryAroundChild.brm, tryAroundChildSibling.brm) and added fixtures for a grandchild (TryMiddle.brm, tryAroundGrandchild.brm), a child in `#if` (tryAroundChildIf.brm) and in `#for` (tryAroundChildFor.brm). TryKid has a throwing handler, an async handler that rejects and an effect that throws.
- On main: the sibling control passes for all three errors; the other 12 time out with no `.caught`.
- Cause has two parts. (1) `tryCatchesClient` in graph.ts looks only at sites of its own file, so a body with only a component gives no `t` table entry, and the graph does not create the body and `#catch` scopes on the client. (2) Even with the entry, the server gave the `#try` body scope no ID when nothing in it needed one, so the child's scope linked to the component scope and `fail` never met the kind in the table. With a sibling handler the body got an ID from the button's `b-b`.
- With fix (1) alone, only the `#for` case passed (its item scope has an ID and is in the table).
- Fix: `tryCatchesClient` returns true when the body holds a component or a dynamic tag; plan.ts gives the body scope an ID when `tryCatchesClient` holds.
- graph.ts importing `forEachNode` from project.ts is an import cycle (oxlint import/no-cycle). Moved `getChildren` and `forEachNode` to ast.ts; project.ts re-exports them, so other importers stay.
- unreadMemoTry.brm: moved the show button out of the `#try`. It fails on main and passes with the fix, so the workaround is gone.
- Updated the `blocks` render snapshot: its `#try` around `<Broken />` now ships the `#catch` body and scope IDs.
- `pnpm --filter brumate test`: 1326 passed (first run hit a beforeAll hook timeout under load 17; rerun clean).
- Draft PR #418. Review round 1 (fresh agent, pr-review): no blocking findings. Found that a `#template` inside a `#try` does not catch client errors, also on main.
- Bench (todos, brumate only): JS before `load` 14.8 kB gzip, the same as main. PR marked ready.
