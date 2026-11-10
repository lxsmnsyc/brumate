---
id: dock-page
title: Page workspace
status: active
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
verify: pnpm --filter brumate exec vitest run test/devtools-dock-page.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/runtime/devtools-panel/page.ts
  - packages/brumate/test/devtools-dock-page.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: it fills the module that the split creates
---

# Page workspace

## Goal

The Page workspace as the prototype draws it: Overview cards, page state and blocks in the prototype's layout. The prototype has no Report, so the old Report tab is dropped (the story rule: the port drops old-panel parts the prototype does not have).

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] Cards, page state (with its size), and blocks (with states) show what the old Overview, Page state and Blocks tabs showed; the Report tab and its code are removed.
- [ ] Old-panel parts that the prototype does not have are removed.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-dock-page.test.ts test/devtools.test.ts`

## Sizing

S: the old tabs move into the prototype's layout, and Report is removed.

## Notes for the worker

- Numbers come from the running page, not from the prototype's sample data.
