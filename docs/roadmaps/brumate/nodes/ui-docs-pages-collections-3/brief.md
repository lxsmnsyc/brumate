---
id: ui-docs-pages-collections-3
title: Anatomy, use cases, CSS and state on the Table, Tree and data pages
status: todo
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - website/ui/table.md
  - website/ui/tree.md
  - website/ui/navigation-tree.md
  - website/ui/virtualizer.md
  - website/ui/data.md
  - website/ui/demos/Table*.brm
  - website/ui/demos/Tree*.brm
  - website/ui/demos/NavigationTree*.brm
  - website/ui/demos/Virtualizer*.brm
  - website/ui/demos/Data*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-collections-2
    kind: hard
    why: it did Menu, ComboBox and Autocomplete and stopped before these five
---

# Anatomy, use cases, CSS and state on the Table, Tree and data pages

## Goal

Bring Table, Tree, NavigationTree, Virtualizer and Data up to the pattern of the Select page (ui-docs-kit).

## Context

- Split from ui-docs-pages-collections-2 on 2026-10-28 (#339). Its outcome.md lists these as "Stubs left".
- `brumate check` reports BRM167 on ui/demos/DataDemo.brm ("Cannot read @brumate/ui/data.brm.ts"), also on main. Find out whether it is a real problem for the Data page and fix it or report it.
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md and the review lessons of the ui-docs-pages-* outcomes. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each page in owns has the four parts, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: five pages, Table and Tree the largest.
