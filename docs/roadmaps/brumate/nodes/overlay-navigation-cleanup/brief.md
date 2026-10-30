---
id: overlay-navigation-cleanup
title: A client navigation away from an open overlay removes its layer and the inert page
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
  - packages/ui/src/overlay.ts
  - packages/ui/src/Popover.brm
  - packages/ui/src/ModalOverlay.brm
  - packages/ui/src/Tooltip.brm
  - packages/ui/test/**
reserves: []
provides: []
depends_on: []
---

# A client navigation away from an open overlay removes its layer and the inert page

## Goal

When a client navigation leaves a page with an open modal, popover or tooltip, the layer is removed, `main` and the rest of the page are no longer inert, scroll is unlocked, and focus is sane on the new page.

## Context

- Found in the review of overlay-start-open (#341), on main too with a modal opened by a press: after a client navigation away, a layer stays behind and `main` stays inert.
- Find which cleanup does not run on unmount (the overlay's `$client` cleanup, the inert and scroll-lock counters, the portal layer) and fix it at the root, so every overlay part benefits.

## Acceptance

- [ ] A test (or e2e step): open a modal, navigate on the client, and the new page has no layer, no inert node, no scroll lock.
- [ ] Checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one missing cleanup path.
