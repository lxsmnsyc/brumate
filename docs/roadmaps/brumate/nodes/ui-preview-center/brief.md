---
id: ui-preview-center
title: Center the demo previews on the ui docs pages
status: todo
priority: should
type: docs
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify: pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns:
  - website/src/components/StyledExample.brm
  - website/src/components/AnatomyFigure.brm
shared:
  - website/src/routes/ui/_layout.brm
reserves: []
provides: []
depends_on: []
---

# Center the demo previews on the ui docs pages

## Goal

Center each demo in its preview box on the /ui pages, horizontally and vertically, the way other headless ui libraries show their examples.

## Context

- The maintainer reported on 2026-10-31 that the previews sit at the left edge of their box.
- `.ui-demo-stage` in website/src/routes/ui/_layout.brm is a wrapping flex row with `align-items: center` and no `justify-content`, so its items start at the left.
- StyledExample.brm (`align-items: flex-start`) and AnatomyFigure.brm (`justify-items: start`, `justify-self: start`) align their demos to the start too. Check each one: the anatomy labels may need to stay at the start.
- The gallery cards on /ui (`.ui-card .ui-demo-stage`) scale the demo to fit with `--fit`. Keep that working, and check that centering does not change the scale origin.
- ui-docs-style-global rewrites the same `:global` rules in _layout.brm. Whichever node lands second rebases on the other.
- Wide demos, such as tables, grids and calendars, should still fill the box or scroll, not overflow on both sides.

## Acceptance

- [ ] On every /ui page, the stage demo, the styled example and the anatomy figure are centered in their boxes.
- [ ] The /ui gallery cards still scale their demos to fit.
- [ ] Wide demos do not clip on the left.
- [ ] `pnpm --filter website check:samples && pnpm --filter website build` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: CSS in three files, checked by eye on the pages.
