---
id: popover-sizing
title: Popovers size and place themselves from CSS
status: todo
priority: could
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/position.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/position.ts
  - packages/ui/src/Popover.brm
  - packages/ui/test/position.test.ts
  - website/ui/popover.md
shared: []
reserves: []
provides: []
depends_on:
  - on: as-controls
    kind: hard
    why: both edit Popover.brm, and as-controls changes its root
  - on: docs-overlays
    kind: hard
    why: both edit popover.md
---

# Popovers size and place themselves from CSS

## Goal

A popover sets its own `max-height` to the room that is left, unless the author CSS sets one, and reads `--anchor-gap`, `--anchor-offset` and `--anchor-padding` as fallbacks for its placement props, as Headless UI does.

## Context

- position.ts already measures the room and sets `--available-height`.
- Source: [Popovers that size and place themselves from CSS](../../../../proposals.md#2-popovers-that-size-and-place-themselves-from-css)

## Acceptance

- [ ] A long Select stays inside the viewport with no author CSS.
- [ ] A `max-height` that the author sets wins.
- [ ] `pnpm --filter @brumate/ui exec vitest run test/position.test.ts` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one module and one part.
