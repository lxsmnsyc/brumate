---
id: ui-docs-pages-fields
title: Anatomy, use cases, CSS and state on the pages of the text and number fields
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
  - website/ui/text-field.md
  - website/ui/search-field.md
  - website/ui/token-field.md
  - website/ui/number-field.md
  - website/ui/slider.md
  - website/ui/demos/TextField*.brm
  - website/ui/demos/SearchField*.brm
  - website/ui/demos/TokenField*.brm
  - website/ui/demos/NumberField*.brm
  - website/ui/demos/Slider*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-forms
    kind: hard
    why: it did Checkbox, Switch, CheckboxGroup, RadioGroup and Form and stopped before these pages
  - on: ui-refused-write-sync
    kind: hard
    why: NumberField's state section depends on whether it shows a refused value
---

# Anatomy, use cases, CSS and state on the pages of the text and number fields

## Goal

Bring TextField, SearchField, TokenField, NumberField and Slider up to the pattern of the Select page (ui-docs-kit): an anatomy picture, two or three use cases that compose parts, a styled example with full CSS, and a controlled and uncontrolled section.

## Context

- Split from ui-docs-pages-forms on 2026-10-28: that node did five pages (#331) and stopped, since about 24 more demos was another review's worth.
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md, the pages of #331, and the lessons in the outcomes of the ui-docs-pages-* nodes.
- All five are form fields and reset with their form (state.md). Describe a refused write as ui-refused-write-sync leaves it. Check every claim against packages/ui/src. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each of the five pages has the four parts, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: five pages of the same pattern.
