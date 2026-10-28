---
id: part-guides
title: Guides for building a part, keyboard and focus, and async content
status: todo
priority: could
type: docs
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/async-overlay.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - website/ui/your-own-parts.md
  - website/ui/keyboard-and-focus.md
  - website/ui/async-content.md
  - website/ui/demos/OwnPartDemo.brm
  - packages/ui/test/async-overlay.test.ts
shared:
  - .changeset/*.md
  - website/src/ui.ts
reserves: []
provides: []
depends_on: []
---

# Guides for building a part, keyboard and focus, and async content

## Goal

Write three guides: how to build a part with the shared press, hover and focus code and the contexts, how keyboard and focus work across the parts, and what a Dialog or Popover does with a `#defer` or `#loading` body. Check first where focus goes when a Dialog opens on a `#defer` body.

## Context

- `press`, `hover` and `focusRing` and the contexts of contexts.ts are exported but have no page.
- Source: [Documented hooks for building a part](../../../../proposals.md#7-documented-hooks-for-building-a-part)
- Source: [Guides that cross parts](../../../../proposals.md#8-guides-that-cross-parts)

## Acceptance

- [ ] A test shows where focus goes for a Dialog that opens on a `#defer` body. A gap it finds is reported as a new node, not fixed here.
- [ ] The samples compile.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: three pages and one test.
