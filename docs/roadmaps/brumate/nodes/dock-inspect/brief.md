---
id: dock-inspect
title: Inspect workspace: component tree and detail
status: done
priority:
type: feature
story: dev-dock-redesign
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools-dock-inspect.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 244000
owns:
  - packages/brumate/src/runtime/devtools-panel/inspect.ts
  - packages/brumate/test/devtools-dock-inspect.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it fills the module that the split creates
---

# Inspect workspace: component tree and detail

## Goal

The Inspect workspace as the prototype draws it: the component tree (with Elements, handlers and reads as the prototype shows them) on one side, the selected component's detail on the other, with a Values | Graph switch. The Values view lists signals, props and memos with edit, as the old Components tab does.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] Selecting a row shows a filled rounded row with a soft ring, with no coloured left edge.
- [ ] The detail has Values | Graph. Graph draws through the `drawGraph` of the graph module (`dock-graph`); until it lands, the old graph code from the split is used.
- [ ] Pick, hover outlines and a component linked from Issues select the matching row.
- [ ] Old-panel parts that the prototype does not have are removed.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-inspect.test.ts test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- Edits to values keep working through the old `editable` and `parseValue` rules.
- The tree and detail split uses `split()` from the contract, so it gets its handle when `dock-split-handle` lands.
