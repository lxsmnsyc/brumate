---
id: ui-docs-pages-utilities
title: Use cases and styled examples on the pages of the utility parts
status: todo
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - website/ui/separator.md
  - website/ui/heading.md
  - website/ui/transition.md
  - website/ui/visually-hidden.md
  - website/ui/keyboard.md
  - website/ui/i18n-provider.md
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
  - on: ui-docs-pages-layout
    kind: hard
    why: it did seven pages and left these six display and utility parts
---

# Use cases and styled examples on the pages of the utility parts

## Goal

Finish Separator, Heading, Transition, VisuallyHidden, Keyboard and I18nProvider: what of the pattern applies to each, as ui-docs-pages-layout's outcome.md lists (Separator a styled example, Transition a styled example with show, appear and unmount, the others one use case each, I18nProvider a locale switch, no anatomy for one-element parts).

## Context

- Split from ui-docs-pages-layout on 2026-10-28 (#336).
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md and the review lessons of the ui-docs-pages-* outcomes. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each page has what applies, or the outcome says why not.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: six small pages.
