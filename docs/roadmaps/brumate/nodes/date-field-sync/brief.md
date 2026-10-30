---
id: date-field-sync
title: DateField shows the kept date, follows the locale and blocks an out-of-range submit
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/date-field.brm.ts
  - packages/ui/src/DateField.brm
  - packages/ui/src/DatePicker.brm
  - packages/ui/src/DateRangePicker.brm
  - packages/ui/src/CalendarCell.brm
  - packages/ui/src/DateSegment.brm
  - packages/ui/test/**
  - website/ui/date-field.md
  - website/ui/date-picker.md
  - website/ui/date-range-picker.md
  - website/ui/state.md
reserves: []
provides: []
depends_on: []
---

# DateField shows the kept date, follows the locale and blocks an out-of-range submit

## Goal

Fix three bugs of the date fields, all confirmed on main in the review of ui-docs-pages-dates (#343), and close a styling gap:

1. A refused `$bind` write: DateField, and the field of a DatePicker, keep the typed or arrowed date while the signal keeps the old one, and a reset does not restore it. `dateSegments` (packages/ui/src/date-field.brm.ts, about lines 25-47) re-reads `value` only in an effect on `value`; read back after the write, as TimeField and DateRangePicker do. This contradicts ui-refused-write-sync's outcome, which listed DateField as in sync.
2. A runtime change of an I18nProvider `locale`: DateField, DatePicker and DateRangePicker segments and placeholders stay in the first locale, because `locale.locale` is passed to `dateSegments` as a plain string at setup (DateRangePicker.brm about 115 and 124); direction and strings are read once too. Calendar, RangeCalendar and TimeField follow it.
3. A date outside `minValue`/`maxValue` sets `data-invalid` but does not stop a submit: the hidden input carries only `required`. Set a custom validity for the range.
4. Gap: CalendarCell has no `data-hovered`; DateSegment has no `data-hovered` or `data-focus-visible`. Add them as the other parts do.

## Context

- Follow #332's rule: the part shows the kept value; `onChange` reports the request.
- Drop the notes on the date pages and in state.md when fixed.

## Acceptance

- [ ] A test per bug, failing on main; each checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: three fixes in the shared date-field code and two data attributes.
