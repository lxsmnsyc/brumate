---
id: overlay-start-open
title: An overlay given an open start value renders open on load
status: active
priority: should
type: fix
outline: false
milestone: ui-0.1
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
  - website/ui/**
reserves: []
provides: []
depends_on: []
---

# An overlay given an open start value renders open on load

## Goal

A Modal, ModalOverlay, Popover (DialogTrigger), TooltipTrigger, MenuTrigger or PreviewTrigger with `isOpen=(true)` or a bound signal that starts true is open after load, rendered by the server where possible.

## Context

- Found in the review of ui-docs-pages-overlays (#333), on main: none of these opens after load, because the overlays open from an `$effect`, and an effect never runs on load (website/docs/effects.md, about line 25).
- Decide per part: render the open layer on the server from the start value, or open it on load from a `$client(..., 'load')`. Keep focus handling right for a modal that starts open.
- #333 rewrites the docs to say they do not start open; update them when this lands.

## Acceptance

- [ ] A test per part: a true start value is open after load, with focus and inert outside as when opened by a press.
- [ ] Checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S to M: one decision applied to the overlay parts.
