---
id: dock-split-handle
title: Resizable split handle
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
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools-dock-split.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 84000
owns:
  - packages/brumate/src/runtime/devtools-panel/split.ts
  - packages/brumate/test/devtools-dock-split.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it replaces the `split()` stub that the split node adds to the contract
---

# Resizable split handle

## Goal

One reusable handle for the splits inside the dock, as the prototype has: shown on hover, draggable, focusable with arrow keys, with a minimum size for each side, and sizes kept per split with the dock's height and side.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] `split(options)` keeps the signature in `contracts/dock-workspace-api.md` and returns two panes with a handle between them.
- [ ] The handle appears on hover and on focus, moves with the arrow keys (larger steps with Shift), and stops at each side's minimum size.
- [ ] Sizes are stored per split key with the dock's height and side, and restored on the next open.
- [ ] A test drags the handle and presses keys, and checks the minimums and the stored sizes.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-split.test.ts`

## Sizing

S: see the owned files above.

## Notes for the worker

- Used by the component tree and its detail, the activity log and a call's detail, and the issue list and its code. Pointer capture, not window listeners, so a drag ends when the pointer is released outside the dock.
- No coloured edge on the handle at rest; the line shows on hover only.
