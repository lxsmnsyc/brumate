---
id: dock-call-detail
title: Server call detail in Activity
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
verify: pnpm --filter brumate exec vitest run test/devtools-dock-call-detail.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 216000
owns:
  - packages/brumate/src/runtime/devtools-panel/call-detail.ts
  - packages/brumate/test/devtools-dock-call-detail.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it adds a module beside the others that the split creates

  - on: dock-call-data
    kind: contract
    via: dock-call-record

  - on: dock-activity
    kind: behavior
    via: dock-workspace-api
---

# Server call detail in Activity

## Goal

The detail of a server call, as the prototype draws it: decoded arguments, the result or the server error with its stack, timing, what ran on the server, what the result changed, and the actions Run again (with a warning about side effects), Copy as fetch and Copy for an agent.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] A selected call shows each part of the story brief's list, from the record in `dock-call-record`. A part with no data is hidden.
- [ ] Run again asks first and names the side effects. Copy as fetch builds a `fetch` call without cookies or headers.
- [ ] Copy for an agent copies text for a coding agent. `devtools-copy` later adds buttons to the same panel and may share its text builder; keep this one in `call-detail.ts`.
- [ ] Values are cut at a length, as the record says.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-call-detail.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- Stack frames use the `stack.ts` helpers for the editor link and source view.
- The button for Copy for an agent is the call detail's own; the general copy buttons of `devtools-copy` are a separate node.
