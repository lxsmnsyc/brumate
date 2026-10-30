---
id: overlay-focus-fixes
title: Focus and repeat fixes for stacked modals, tooltips and preview cards
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/**
  - packages/ui/test/**
reserves: []
provides: []
depends_on: []
---

# Focus and repeat fixes for stacked modals, tooltips and preview cards

## Goal

Closing a Modal and the Modal over it in one step returns focus to the button that opened the first, with CSS transitions too; a tooltip whose `$bind` setter refused is asked again on the next hover or focus; a press on a PreviewTrigger after a hover hides the preview.

## Context

- Found in the review of ui-docs-pages-overlays (#333), all on main:
  - Nested modals: with a 0.2 s opacity transition on `[data-modal-overlay]` and `[data-closed]`, closing both in one step leaves focus on `body`; with no transition it returns to the button.
  - Tooltip: with a refusing setter, a hover that returns within `closeDelay` is not asked again; the early return `current?.id === id` in tooltip.ts `show()` skips it. A focus after a refusal is not asked either.
  - PreviewTrigger: after a hover, a press fades the card out and it comes back in about 370 ms; a keyboard Enter does hide it.

- From the review of overlay-start-open (#341): a modal and a menu that both start open do not stack. Focus stays on the modal, the modal layer is not inert, and the first Escape closes the modal, leaving the menu open with nothing inert. Two modals stack through `queueLoad` in overlay.ts; give the Popover path the same stacking, or document that only one overlay of mixed kinds may start open. Presses cannot reach this case.

## Acceptance

- [ ] A test for each of the three, and each checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: three small fixes in the overlay code.
