---
id: dock-canvas-outlines
title: Update outlines on one canvas
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
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools-flash.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/runtime/devtools-flash.ts
  - packages/brumate/test/devtools-flash.test.ts
shared:
  - packages/brumate/src/runtime/devtools.ts
reserves: []
provides: []
depends_on: []
---

# Update outlines on one canvas

## Goal

Draw the update outlines on one `<canvas>` overlay in place of a `<div>` per box. It is independent of the panel.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] `installFlash` moves to `devtools-flash.ts` and draws on one canvas that covers the viewport with `pointer-events: none`.
- [ ] The canvas keeps a list of boxes with rect, heat colour and start time, and redraws them in one `requestAnimationFrame` loop that fades them and stops when the list is empty.
- [ ] It sizes itself to `devicePixelRatio` and redraws on resize and scroll. The MutationObserver and the heat counts stay.
- [ ] No `div.flash` is added to the shadow root and no `setTimeout` removes boxes. `MAX_FLASHES` still caps a frame.
- [ ] A test changes elements and checks the box list, the fade and that the loop stops.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-flash.test.ts test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- The `flash` setting stored under `brumate:devtools:flash` keeps working; the shell node reads it for its toggle.
- Edit only the `installFlash` part of `devtools.ts`; `dock-call-data` edits `CallTiming` in the same file.
