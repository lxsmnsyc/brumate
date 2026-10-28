---
id: ui-docs-pages-collections-2
title: Anatomy, use cases, CSS and state on the rest of the Collections pages
status: active
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
  - website/ui/menu.md
  - website/ui/combo-box.md
  - website/ui/autocomplete.md
  - website/ui/table.md
  - website/ui/tree.md
  - website/ui/navigation-tree.md
  - website/ui/virtualizer.md
  - website/ui/data.md
  - website/ui/demos/Menu*.brm
  - website/ui/demos/ComboBox*.brm
  - website/ui/demos/Autocomplete*.brm
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
  - on: ui-docs-pages-collections
    kind: hard
    why: it did ListBox, Tabs, TagGroup and GridList and stopped before these pages
---

# Anatomy, use cases, CSS and state on the rest of the Collections pages

## Goal

Bring the remaining Collections pages up to the pattern of the Select page (ui-docs-kit): Menu, ComboBox, Autocomplete, Table, Tree, NavigationTree, and the other pages listed in owns. Each gets an anatomy picture, two or three use cases that compose parts, a styled example with full CSS, and a controlled and uncontrolled section.

## Context

- Split from ui-docs-pages-collections on 2026-10-28: that node did four pages (#329) and stopped at 20 new demos to keep one review coherent. Its outcome.md lists these pages as "Stubs left".
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md, the pages of #329, and the lessons in the outcomes of ui-docs-pages-controls and ui-docs-pages-collections.
- ComboBox is a form field and resets with its form (state.md); Menu, Autocomplete, Table and Tree are not. Check every claim against packages/ui/src. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each page in owns has the four parts, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about eight pages of the same pattern.
