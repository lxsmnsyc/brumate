---
id: ui-date-i18n
title: Localized strings and placeholders of the date parts, and a correct today
status: done
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - packages/ui/src/date-strings.ts
  - packages/ui/test/date-i18n*
shared:
  - .changeset/*.md
  - packages/ui/src/segments.ts
  - packages/ui/src/calendar.ts
  - packages/ui/src/DateSegment.brm
  - packages/ui/src/DateInput.brm
  - packages/ui/src/DateField.brm
  - packages/ui/src/TimeField.brm
  - packages/ui/src/Calendar.brm
  - packages/ui/src/RangeCalendar.brm
  - packages/ui/src/CalendarGrid.brm
  - packages/ui/src/DatePicker.brm
  - packages/ui/src/DateRangePicker.brm
  - packages/ui/src/I18nProvider.brm
  - packages/ui/test/**
  - website/ui/**
reserves: []
provides: []
depends_on: []
---

# Localized strings and placeholders of the date parts, and a correct today

## Goal

The date parts of @brumate/ui speak only English, and "today" can be wrong. Fix both, in a first cut that stays small.

1. Placeholders: `PLACEHOLDERS` in segments.ts is English (`mm`, `dd`, `yyyy`). Use a table per language of year, month and day, from the placeholders that browsers use in their own date inputs (for example German `jjjj`, `mm`, `tt`; Japanese `年`, `月`, `日`). Time segments keep `––`.
2. Segment names for screen readers (`SEGMENT_NAMES`): take them from `Intl.DisplayNames(locale, { type: 'dateTimeField' })`, with the English names as the fallback where the browser lacks it.
3. Labels: `'Empty'` (DateSegment.brm), `'Previous'` and `'Next'` (Calendar.brm), `'Calendar'` (DatePicker.brm), and "Today" and "selected" in cell labels. Keep them in one small table per language in date-strings.ts. Since the server knows the locale, ship only that language's strings to the browser, not every language. Let an app replace the whole set with one `strings` prop or context, not key by key.
4. Today: compute it from a time zone the app gives (a prop or the I18nProvider), or from the value's own zone, not the server's zone (calendar.ts `today`, Calendar.brm:131). The server writes its date into the page, so the first browser render matches the HTML. Then the browser takes its own date, and updates it on `visibilitychange` and at the next midnight.

## First cut

- Languages: English, German, French, Spanish, Japanese and Chinese (the maintainer's choice, 2026-10-28). Other languages fall back to English. Adding a language is one table entry.
- Left out: choosing a non-Gregorian calendar (the date parts use Gregorian in every locale since #312), overriding one label at a time, prompts of a range selection, and era or time-zone-name segments.

## Context

- #312 adds `calendar: 'gregory'` to the formatters; build on it, merged or not.
- Read how I18nProvider gives the locale today, and the docs of the date pages on main (website/ui/date-field.md, calendar.md), which now name the English-only strings as a limit. Update them.

## Acceptance

- [ ] Tests: in `de-DE`, the placeholders are `tt.mm.jjjj` in the locale's order, the segment names and labels are German, and an unknown locale falls back to English.
- [ ] Only the strings of the page's language reach the browser: a test or a size check shows the other languages are not in the client code of a page.
- [ ] Today: a server render in one time zone and a browser in another agree on first render, then the browser shows its own today. A test moves the clock past midnight and the highlight follows.
- [ ] The gzip size of a page with a DatePicker grows by at most 0.5 kB.
- [ ] The ui suite, `brumate-tsc` in packages/ui and the website, and check:samples pass.

## Sizing

M: a strings module, three call sites, and the server-to-browser today.
