---
id: context-menu
title: A context menu, and a shortcut that opens a dialog
status: todo
priority: could
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/context-menu.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/MenuTrigger.brm
  - packages/ui/src/DialogTrigger.brm
  - packages/ui/test/context-menu.test.ts
  - website/ui/menu.md
  - website/ui/autocomplete.md
  - website/ui/demos/CommandPaletteDemo.brm
  - website/ui/demos/ContextMenuDemo.brm
shared:
  - packages/ui/src/position.ts
  - website/src/ui.ts
  - examples/ui/src/**
  - e2e/suites/ui/**
reserves: []
provides: []
depends_on:
  - on: docs-collections
    kind: hard
    why: both edit menu.md and autocomplete.md
  - on: popover-sizing
    kind: hard
    why: both edit position.ts, which must place an overlay at a point
  - on: split-ui-examples
    kind: hard
    why: it adds an example and an e2e step
---

# A context menu, and a shortcut that opens a dialog

## Goal

`MenuTrigger` takes `trigger="contextmenu"`, which opens the menu at the pointer on a right click or a long press. `DialogTrigger` takes `shortcut="Mod+K"`, for a command palette. A recipe in the autocomplete docs builds the palette.

## Context

- position.ts places an overlay next to a trigger. A context menu needs a point instead.
- Source: [A context menu and a command palette](../../../../proposals.md#4-a-context-menu-and-a-command-palette)

## Acceptance

- [ ] A right click opens the menu at the pointer, and Escape gives focus back.
- [ ] Mod+K opens the dialog, and the shortcut does nothing in a text field that handles it.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: placing at a point is new in position.ts.
