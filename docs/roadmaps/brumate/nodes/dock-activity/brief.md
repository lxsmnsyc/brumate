---
id: dock-activity
title: Activity workspace: log, timeline and call list
status: todo
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
verify: pnpm --filter brumate exec vitest run test/devtools-dock-activity.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/runtime/devtools-panel/activity.ts
  - packages/brumate/test/devtools-dock-activity.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it fills the module that the split creates
---

# Activity workspace: log, timeline and call list

## Goal

The Activity workspace as the prototype draws it: one log of handlers, writes, calls, effects and navigation with filters, a timeline, and a list of server calls. Selecting a call opens a detail pane that `dock-call-detail` fills.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] Log, Timeline, Effects, Navigation and Server entries appear in the prototype's layout, with pause, clear and filter.
- [ ] The log and the detail use `split()`. With no call selected, the detail pane shows the prototype's empty state.
- [ ] A call row shows name, status and timing from `CallTiming`; the detail pane is a stub slot that `dock-call-detail` fills.
- [ ] Old-panel parts that the prototype does not have are removed.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-activity.test.ts test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- Do not add the data of calls here. This node shows what the panel records today.
- The detail slot is a function in the workspace context, so `dock-call-detail` adds its module without editing this file.
