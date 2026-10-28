---
id: ui-docs-pages-layout
title: Anatomy, use cases, CSS and state on the pages of navigation, status, layout and utilities
status: done
priority: should
type: docs
outline: false
milestone: 0.4.0
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
  - website/ui/disclosure.md
  - website/ui/disclosure-group.md
  - website/ui/breadcrumbs.md
  - website/ui/toolbar.md
  - website/ui/meter.md
  - website/ui/progress-bar.md
  - website/ui/group.md
  - website/ui/separator.md
  - website/ui/heading.md
  - website/ui/transition.md
  - website/ui/visually-hidden.md
  - website/ui/keyboard.md
  - website/ui/i18n-provider.md
  - website/ui/demos/Disclosure*.brm
  - website/ui/demos/DisclosureGroup*.brm
  - website/ui/demos/Breadcrumbs*.brm
  - website/ui/demos/Toolbar*.brm
  - website/ui/demos/Meter*.brm
  - website/ui/demos/ProgressBar*.brm
  - website/ui/demos/Group*.brm
  - website/ui/demos/Separator*.brm
  - website/ui/demos/Heading*.brm
  - website/ui/demos/Transition*.brm
  - website/ui/demos/VisuallyHidden*.brm
  - website/ui/demos/Keyboard*.brm
  - website/ui/demos/I18nProvider*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-overlays
    kind: hard
    why: it did the seven overlay pages and stopped before these
---

# Anatomy, use cases, CSS and state on the pages of navigation, status, layout and utilities

## Goal

Bring the remaining pages of the overlays node up to the pattern of the Select page (ui-docs-kit): Disclosure, DisclosureGroup, Breadcrumbs, Toolbar, Meter, ProgressBar, Group, Separator, Heading, Transition, VisuallyHidden, Keyboard and I18nProvider. Many are display or utility parts: give each what applies (an anatomy picture for parts with pieces, use cases that compose them, a styled example, and a state section only for parts with state, such as Disclosure's `isExpanded`), and say in the outcome what was skipped and why.

## Context

- Split from ui-docs-pages-overlays on 2026-10-28: that node did seven overlays (#333) and stopped at 35 demos. Its outcome.md lists these as "Stubs left".
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md and the review lessons in the outcomes of the ui-docs-pages-* nodes. Check every claim against packages/ui/src. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each page in owns follows the pattern where it applies, or the outcome says why not.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: thirteen pages, most of them small.
