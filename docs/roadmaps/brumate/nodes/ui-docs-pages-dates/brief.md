---
id: ui-docs-pages-dates
title: Anatomy, use cases, CSS and state on the pages of the date parts
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
  - website/ui/calendar.md
  - website/ui/range-calendar.md
  - website/ui/date-field.md
  - website/ui/time-field.md
  - website/ui/date-picker.md
  - website/ui/demos/Calendar*.brm
  - website/ui/demos/RangeCalendar*.brm
  - website/ui/demos/DateField*.brm
  - website/ui/demos/TimeField*.brm
  - website/ui/demos/DatePicker*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-colors-dates
    kind: hard
    why: it did the seven color pages and stopped before the date pages
  - on: ui-refused-write-sync
    kind: hard
    why: TimeField and DateRangePicker state sections depend on its fix
---

# Anatomy, use cases, CSS and state on the pages of the date parts

## Goal

Bring Calendar, RangeCalendar, DateField, TimeField, DatePicker and the other date pages in owns up to the pattern of the Select page (ui-docs-kit): an anatomy picture, two or three use cases that compose parts, a styled example with full CSS, and a controlled and uncontrolled section.

## Context

- Split from ui-docs-pages-colors-dates on 2026-10-28: that node did the seven color pages (#334) and stopped to keep one review.
- At least one use case shows a locale through I18nProvider (ui-date-i18n). The date fields reset with their form; the calendars are not form fields (state.md).
- /ui/calendar fails axe scrollable-region-focusable on main (node ui-scroll-focus); exclude `.props-table` as the other flows do, do not turn the rule off.
- Follow docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md and the review lessons of the ui-docs-pages-* outcomes. Never name React Aria or Terracotta.

## Acceptance

- [ ] Each page in owns has the four parts, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: five or six pages of the same pattern.
