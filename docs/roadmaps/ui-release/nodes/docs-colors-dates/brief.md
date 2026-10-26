---
id: docs-colors-dates
title: Complete the docs of Colors and Dates
status: todo
priority: must
type: docs
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - website/ui/color-picker.md
  - website/ui/color-swatch.md
  - website/ui/color-slider.md
  - website/ui/color-area.md
  - website/ui/color-wheel.md
  - website/ui/color-field.md
  - website/ui/color-swatch-picker.md
  - website/ui/calendar.md
  - website/ui/range-calendar.md
  - website/ui/date-field.md
  - website/ui/time-field.md
  - website/ui/date-picker.md
shared:
  - website/ui/demos/**
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: contract
    via: props-table
---

# Complete the docs of Colors and Dates

## Goal

Bring each page of Colors and Dates in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: color-picker, color-swatch, color-slider, color-area, color-wheel, color-field, color-swatch-picker, calendar, range-calendar, date-field, time-field, date-picker.
- The props table comes from the generator of docs-generator, through the props-table contract. Do not write props tables by hand.
- The parts and their behavior are in packages/ui/src. Read the doc comment at the top of each part for its attributes and keys.
- Source: [Props tables, anatomy and keyboard tables in the docs](../../../../proposals.md#1-props-tables-anatomy-and-keyboard-tables-in-the-docs)
- Source: [The docs of @brumate/ui](../../../../proposals.md#the-docs-of-brumateui)

## Acceptance

- [ ] Each page has the sections Anatomy, Props, Data attributes, Keyboard (where the part takes keys), Controlled and uncontrolled (where it has state) and Styling.
- [ ] Every new sample compiles: `pnpm --filter website check:samples`.
- [ ] The website builds: `pnpm --filter website build`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 15 pages of docs in one pattern, no code changes.

## Notes for the worker

- Demos live in website/ui/demos. Only edit the demos of the parts on your pages.
- Follow the plain-writing rules: short sentences, no em-dashes, no metaphors.
