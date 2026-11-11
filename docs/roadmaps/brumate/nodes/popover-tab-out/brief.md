---
id: popover-tab-out
title: A non-modal popover closes when Tab leaves its panel
status: active
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.7.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-11
spent:
owns: []
shared:
  - packages/ui/src/Popover.brm
  - packages/ui/src/overlay.ts
  - packages/ui/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A non-modal popover closes when Tab leaves its panel

## Goal

Tab from the last tabbable element of a non-modal popover's panel moves focus to the element after its trigger, and Shift+Tab from the first goes back to the trigger, and the popover closes as focus leaves it. Today the panel renders at the end of the page, so Tab from its last element leaves the document; `blurOutside` sees no focus event and the popover stays open (`containTab` and `keepFocus` are for modal popovers only).

## Context

- Found in the popover-group-alert review (2026-11-11). On main and release/0.8.
- popover-group-alert (0.8.0) adds `leaveByTab` in packages/ui/src/overlay.ts for non-modal popovers in a PopoverGroup only. When release-0.7.1 merges main into release/0.8, use one rule for both: every non-modal popover leaves by Tab this way, and a group keeps its members open.
- Prior art: Headless UI's Popover moves focus from the end of the panel to the element after the button and closes on focus leaving.

## Acceptance

- [ ] A test that fails on main: Tab from the last element of a non-modal popover panel focuses the element after the trigger and the popover closes; Shift+Tab from the first element focuses the trigger.
- [ ] Modal popovers keep their focus trap.
- [ ] Patch changeset for `@brumate/ui`.
- [ ] `pnpm --filter @brumate/ui exec vitest run`, `node e2e/run.mjs --only ui`, `pnpm exec oxlint`, `pnpm format:check`, typecheck.
