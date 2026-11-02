# Outcome: async-memo-block-headers

## Built

- `Emitter.settledMemos` in packages/brumate/src/codegen/markup.ts takes a list of expressions. `emitNodesBlock` passes the `#if`/`#switch` conditions and the `#for` list or `#repeat` count. `emitComponent` passes prop values, spreads and computed names, but not handlers or props that are a function expression. Reads inside a function now count.
- In packages/brumate/src/codegen/template.ts a `component` write (child component or block nodes) carries `settled`, and its `$$b.place(...)` goes into `$$b.fillSettled`. No runtime change.
- Tests in packages/brumate/test/resume.test.ts, describe "a block, prop or function that reads a constant async memo, in a browser render", 17 cases. Fixtures: test/render/gapBlock*.brm, GapBlockCard.brm, GapBlockLater.brm, new loaders in gapData.ts.
- Changeset .changeset/async-memo-block-headers.md (patch, brumate).
- PR #421.

## Deviations

- None. The memos stay non-live; server output does not change.

## Stubs left

- None.

## Gotchas

- In brm, `user={user}` is an object literal prop `{ user: user }`. Use `{user}` or `user=(user)`.
- A component whose props read such a memo now gets the settled value, not the promise, and renders only after it settles.
- Still not covered: dynamic tags, windowed `#for`, markup the browser renders as HTML strings, and props that hold a function only inside another value (`cond ? () => a : () => b`, an object with a method), which still hold the component.
- A header that mixes the memo with a live signal was already right: the memo becomes live there.

## Proposed learnings

- A block, list or component that the browser renders once from a memo that never changes must wait for the memo, as text does | no update renders it again | packages/brumate/src/codegen | yes

## Verification

- On main, 11 of the 17 cases fail (all browser and rejection cases); the server controls and the function-prop case pass. On the branch all 17 pass. With `settledMemos` disabled they fail again (reviewer).
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1361 passed) pass. No snapshot changes.
- `pnpm bench --only brumate --scenario todos`: JS before `load` is 5 files, 35.5 kB / 14.8 kB gzip, same as main.
- Review round 1: no blocking. Fixed: function-valued props held the component; changeset line about props. Left: test observer ignores empty states (expected for held inserts).
- Review round 2: clean. One note, recorded as a limit.

## Size

- Estimated M, actual S/M: two codegen files, no runtime change.
