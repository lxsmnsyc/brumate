---
id: graph-node-locations
title: File locations for each node of the reactivity graph
status: todo
priority: should
type: feature
outline: false
milestone: 0.7.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/devtools-panel.ts
  - packages/brumate/test/devtools.test.ts
  - website/docs/inspect.md
reserves: []
provides: []
depends_on: []
---

# File locations for each node of the reactivity graph

## Goal

Each node of a component's graph carries its place in the file, so the devtools can open it in the editor and show where it is.

## Context

- Asked by the maintainer on 2026-11-05, while reviewing the graph of dev-dock-redesign.
- The inspect endpoint builds the graph in `packages/brumate/src/vite.ts` (around line 1296). Today:
  - Signals, props and memos get `kind`, `label` (the name), `scope` and `slot`, and no place in the file.
  - Markup nodes have their place only inside the label text, such as `insert 9:42`, from `result.locate(node.site.range.start)` and `getLocation`. Code that a module function gave the component has no place in the component's file and gets no location.
- `GraphNode` in `packages/brumate/src/runtime/devtools-panel.ts` has `kind`, `label`, `scope` and `slot` only.
- The panel already opens files with `/__open-in-editor?file=<path>:<line>:<column>` (devtools-panel.ts, around lines 648 and 1506), and the anchors of the Elements tab already carry an `at` string.

## Shape

- Add `at?: { line: number; column: number; file?: string }` to each graph node: the declaration for signals, props and memos (the name, not the initializer), and the start of the site for markup, blocks and effects. `file` is set when the code comes from another file, such as a module function, so that case gets a location too.
- Keep markup labels unique without the place in the text: the label becomes the site label alone, and the panel shows `line:column` from `at`.
- The Graph tab uses it: the node's side panel shows `line N` as a link that opens the editor, and the node's tooltip names the place.

## Acceptance

- [ ] Every node of the graph of each test page has `at`, or the test names why one cannot have it.
- [ ] Clicking the place of a node in the Graph tab opens the editor at its line and column.
- [ ] A node from a module function carries the module's file.
- [ ] `website/docs/inspect.md` says a node links to its place in the file.

## Sizing

S: one field in the inspect endpoint, one link in the panel, and tests.
