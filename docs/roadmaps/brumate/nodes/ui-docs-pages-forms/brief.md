---
id: ui-docs-pages-forms
title: Anatomy, use cases, CSS and state on the pages of Forms
status: done
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
  - website/ui/checkbox.md
  - website/ui/checkbox-group.md
  - website/ui/radio-group.md
  - website/ui/switch.md
  - website/ui/form.md
  - website/ui/demos/TextField*.brm
  - website/ui/demos/SearchField*.brm
  - website/ui/demos/TokenField*.brm
  - website/ui/demos/NumberField*.brm
  - website/ui/demos/Slider*.brm
  - website/ui/demos/Checkbox*.brm
  - website/ui/demos/CheckboxGroup*.brm
  - website/ui/demos/RadioGroup*.brm
  - website/ui/demos/Switch*.brm
  - website/ui/demos/Form*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-controls
    kind: hard
    why: it did the Buttons pages of the same family and stopped before these ten
  - on: ui-form-reset
    kind: hard
    why: the state sections describe form reset, which ui-form-reset adds to these parts
---

# Anatomy, use cases, CSS and state on the pages of Forms

## Goal

Bring the ten Forms pages up to the pattern of the Select page (ui-docs-kit): TextField, SearchField, TokenField, NumberField, Slider, Checkbox, CheckboxGroup, RadioGroup, Switch and Form. Each gets an anatomy picture, two or three use cases that compose parts, a styled example with its full CSS, and a controlled and uncontrolled section with each state shape, change callbacks and form reset.

## Context

- Split from ui-docs-pages-controls on 2026-10-28: that node did the six Buttons pages (#326) and stopped, since about 22 demos for six pages was one review's worth, and these pages describe reset that ui-form-reset adds.
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md and the Buttons pages of #326. Form use cases are where composition shows best: a sign-up form with validation, a filter bar, a settings panel.
- Check every claim against packages/ui/src. Never name React Aria or Terracotta in pages.

## Acceptance

- [ ] Each of the ten pages has the four parts, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests (anatomy.test.ts) and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: ten pages of the same pattern.
