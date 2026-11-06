# Outcome: graph-node-locations

## Built

- `at?: { line, column, file? }` on each graph node of the inspect endpoint (`packages/brumate/src/vite.ts`, `placeOf`). Signals, props and memos get the place of the name; markup, blocks and effects get the start of the site. Markup labels are the site label alone.
- Graph tab (`packages/brumate/src/runtime/devtools-panel.ts`): box shows `kind · line:column`, tooltip names the line, side panel has a `line N` link that opens `/__open-in-editor` at line and column, in the module's file when `file` is set.
- `website/docs/inspect.md` and `.changeset/graph-node-locations.md` (minor).

## Deviations

- Added `packages/brumate/test/vite-app/uses-counter.brm`, a test fixture for the module-function case (no vite-app page called a module function).

## Stubs left

- None.

## Gotchas

- If a module file cannot be read from disk, the node has no `at`.
- Labels of markup nodes are no longer unique; the panel's Reads/Read by lists show the bare label.

- The orchestrator added the place to the Reads and Read by lists for labels that more than one node shares, such as `insert 12:4`, since markup labels lost their place. `devtools.test.ts` covers it.

## Proposed learnings

- None.

## Verification

- `vitest run test/vite.test.ts test/devtools.test.ts` pass. Acceptance: every node of the counter and uses-counter pages has `at` (tested); click opens the editor (tested); module node carries the module file (tested); docs updated.

## Size

- Estimated S, actual S.
