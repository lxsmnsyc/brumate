---
id: dock-issues
title: Issues workspace
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
verify: pnpm --filter brumate exec vitest run test/devtools-dock-issues.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 161000
owns:
  - packages/brumate/src/runtime/devtools-panel/issues.ts
  - packages/brumate/test/devtools-dock-issues.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it fills the module that the split creates
---

# Issues workspace

## Goal

The Issues workspace as the prototype draws it: the list of issues (errors and warnings) on one side, the selected issue's code with its stack and source on the other, joined by a split handle.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] The list shows the count in the nav badge and a filled rounded selected row with a soft ring.
- [ ] The code pane shows the highlighted source with the failing line, the frames of the stack and open-in-editor links, as the old Errors tab does.
- [ ] Old-panel parts that the prototype does not have are removed.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-issues.test.ts test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- The highlighter loads with the first code shown, as today. Keep that lazy load.
