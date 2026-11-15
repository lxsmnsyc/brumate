---
id: dock-graph
title: Graph view: layered DAG with lineage
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
verify: pnpm --filter brumate exec vitest run test/devtools-dock-graph.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 264000
owns:
  - packages/brumate/src/runtime/devtools-panel/graph.ts
  - packages/brumate/test/devtools-dock-graph.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it fills the graph module that the split creates
---

# Graph view: layered DAG with lineage

## Goal

The Graph view of Inspect as the story brief fixes it: every signal, prop, memo, markup read and effect of the selected component as a layered DAG with the current value on each node, writes marked in yellow, a click that dims all but the lineage, and pan and zoom with a fit button.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] A node's column is its depth, the longest path from a source, not its kind; edges that skip a column route through it; columns are sorted to cross less and are centred. `layoutGraph` keeps its export and tests for these rules.
- [ ] Arrowheads show the flow. No legend and no column headings: the dot colour gives the kind and its tooltip names it. Nothing folds into a chain.
- [ ] A write marks its node and every node after it in yellow for `HOT_MS`.
- [ ] A click dims everything outside the node's lineage and opens what it reads, what reads it and its place in the file (a link from `graph-node-locations`); empty sections are hidden.
- [ ] Pan, zoom at the pointer and a fit button work.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-graph.test.ts test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- `layoutGraph` is exported and covered by `devtools.test.ts`; keep its signature or update those tests in this node.
- Export `drawGraph(ctx, scope, info)` for `dock-inspect`. Both nodes agree on it in the contract's workspace context; if the signature needs to change, write a change request.
