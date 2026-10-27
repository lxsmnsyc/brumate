---
id: docs-colors-dates
title: Complete the docs of Colors and Dates
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
  - website/ui/demos/ColorPicker*.brm
  - website/ui/demos/ColorSwatch*.brm
  - website/ui/demos/ColorSlider*.brm
  - website/ui/demos/ColorArea*.brm
  - website/ui/demos/ColorWheel*.brm
  - website/ui/demos/ColorField*.brm
  - website/ui/demos/ColorSwatchPicker*.brm
  - website/ui/demos/Calendar*.brm
  - website/ui/demos/RangeCalendar*.brm
  - website/ui/demos/DateField*.brm
  - website/ui/demos/TimeField*.brm
  - website/ui/demos/DatePicker*.brm
shared:
  - .changeset/*.md
  - packages/ui/src/*.brm
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: hard
    why: the props-table format and its renderer exist only after docs-generator
---

# Complete the docs of Colors and Dates

## Goal

Bring each page of Colors and Dates in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: color-picker, color-swatch, color-slider, color-area, color-wheel, color-field, color-swatch-picker, calendar, range-calendar, date-field, time-field, date-picker.
- The props table comes from the generator of docs-generator, through the props-table contract. Do not write props tables by hand.
- Write against the frozen props-table contract (contracts/props-table.md). Most props have no doc comment yet, so their Description cells are empty: write a one-sentence doc comment for each prop of your parts in packages/ui/src, and never name React Aria. See nodes/docs-generator/outcome.md.
- The parts and their behavior are in packages/ui/src. Read the doc comment at the top of each part for its attributes and keys.
- Source: [Props tables, anatomy and keyboard tables in the docs](../../../../proposals.md#1-props-tables-anatomy-and-keyboard-tables-in-the-docs)
- Source: [The docs of @brumate/ui](../../../../proposals.md#the-docs-of-brumateui)

## Acceptance

- [ ] Each page has the sections Anatomy, Props, Data attributes, Keyboard (where the part takes keys), Controlled and uncontrolled (where it has state) and Styling.
- [ ] Every sample of the pages compiles: `pnpm --filter website check:samples`, which reads website/ui since docs-generator.
- [ ] The website builds: `pnpm --filter website build`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 15 pages of docs in one pattern, no code changes.

## Notes for the worker

- Demos live in website/ui/demos. Only edit the demos of the parts on your pages.
- Follow the plain-writing rules: short sentences, no em-dashes, no metaphors.
