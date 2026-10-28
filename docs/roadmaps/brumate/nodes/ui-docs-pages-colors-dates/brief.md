---
id: ui-docs-pages-colors-dates
title: Anatomy, use cases, CSS and state on the pages of Colors and dates
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
  - website/src/routes/ui/_layout.brm
  - website/ui/demos/Landing*.brm
reserves: []
provides: []
depends_on:
  - on: ui-docs-kit
    kind: hard
    why: it makes the anatomy and styled-example blocks and the Select page that these pages follow
---

# Anatomy, use cases, CSS and state on the pages of Colors and dates

## Goal

Bring every page of Colors and dates up to the pattern of the Select page from ui-docs-kit:

- an anatomy picture above the Anatomy section, with numbered callouts tied to the tag tree;
- two or three use cases that compose the part with others, such as a part in a form with validation or inside a toolbar, each a live demo with its source;
- a styled example with its complete CSS;
- a section on controlled and uncontrolled with an example of each shape that the part's state props allow, the change callbacks and form reset, linking to state.md.

## Context

- Read docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md first, and copy the Select page's structure.
- The maintainer's review on 2026-10-28 asked for these four on every part page.
- A part without state skips the controlled and uncontrolled section; a part without pieces (one element) gets no anatomy picture. Say which in the outcome.
- Check each use case against the code: claims that did not match the code were the main review finding of the earlier docs nodes.
- Style demos with the site's demo classes in website/src/routes/ui/_layout.brm; give a new demo class a name of its own (the slider and switch once shared `ui-track`).
- Never name React Aria.

## Acceptance

- [ ] Every page in owns has the four parts above, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation on the pages.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about a dozen pages of the same pattern.
