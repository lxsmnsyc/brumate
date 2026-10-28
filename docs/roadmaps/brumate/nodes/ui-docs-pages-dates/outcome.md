# Outcome: ui-docs-pages-dates

## Built

The pages of the five date parts in owns, and the page of DateRangePicker, which the brief does not list but which holds the same pieces. Each has an anatomy picture, a styled example with full CSS, a state section with a live demo, and two use cases.

| Page            | Anatomy                                                 | Use cases                                                  | Styled                | Controlled and uncontrolled                                 |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| Calendar        | CalendarAnatomy                                         | a locale through I18nProvider, two months with taken days  | CalendarStyled        | CalendarStateDemo, four shapes and `focusedValue`           |
| RangeCalendar   | RangeCalendarAnatomy                                    | a stay over two months, a locale through I18nProvider      | RangeCalendarStyled   | RangeCalendarStateDemo, four shapes                         |
| DateField       | DateFieldAnatomy (one segment marked by a template)     | a form with limits, three locales on one signal            | DateFieldStyled       | DateFieldStateDemo, four shapes and a reset                 |
| TimeField       | TimeFieldAnatomy                                        | opening hours in a form, a clock by locale and `hourCycle` | TimeFieldStyled       | TimeFieldStateDemo, four shapes and a reset                 |
| DatePicker      | DatePickerAnatomy (field, Popover, Dialog and Calendar) | a booking form, two locales on one signal                  | DatePickerStyled      | DatePickerStateDemo, four shapes, `isOpen` and a reset      |
| DateRangePicker | DateRangePickerAnatomy                                  | a stay in a form, two locales on one signal                | DateRangePickerStyled | DateRangePickerStateDemo, four shapes, `isOpen` and a reset |

- Every claim was read against packages/ui/src and checked in Chrome with real keys. The Calendar and RangeCalendar pages say that they are not form fields and do not reset.
- website/src/routes/ui/_layout.brm: the shared `.ui-calendar` rules now reset the heading rule and the table borders that the prose styles of the page gave the Calendar. Before, the existing demos drew a rule above the month and a bordered table that ran past the Calendar, and the text under it overlapped the grid.
- The day numbers of the Calendar are centered in the shared reset and in the styled sheets, since `.prose td` aligns them left.
- website/ui/state.md: one sentence in Form reset now names the DateField exception below.
- e2e/suites/website.mjs: two flows. One checks the anatomy, the CSS and axe (no overrides) on the six pages in both schemes. The other uses real keys and clicks: a pick by click and by arrow keys, a locked signal, a taken day, a stay of nights, typed digits, a reset, a limit that blocks the form, a closing time before the opening time, a picker that opens from outside, picks, closes and gives focus back, and a range pick. With the Lock check of the Calendar demo removed the flow fails on "a locked signal changed", and with the `minValue` of the closing time removed it fails on "a 7 AM close is valid".
- Colors use `light-dark()` and system colors, with an `outline: none` and a ring of two bands. Measured in Chrome against the stage (`--surface`), with the site theme toggled against the OS setting: borders 4.89:1 dark and 3.44:1 light, the accent 7.58:1 and 4.23:1, the text on the accent 8.09:1 and 4.85:1, the muted text 8.73:1 and 7.37:1, the error text 7.25:1 and 5.01:1. The pale band of a range has lines of the accent above and below it, since the band alone is below 3:1. Axe `color-contrast` finds nothing at rest on the six pages in the four combinations of OS and site theme, nor with the Popover of the two pickers open.

## Deviations

- DateRangePicker is not in `owns` of the brief. Its page got the same four parts, so the six date parts are consistent. Its Anatomy, Props, Data attributes, Controlled and uncontrolled, Styling and Use cases sections are new.
- The locale use cases of DateField, DatePicker and DateRangePicker show fixed locales side by side, not a switch. The segments of those parts do not follow a change of `locale` after the first render (see Part bugs). The Calendar, RangeCalendar and TimeField demos switch the locale and follow it.
- The anatomy of DateField and TimeField marks one segment, through a `segment` template with an `#if`, and a style of the demo moves its badge above the segment so that it stays off the digits.
- The pickers draw the field, then the Popover, the Dialog and the Calendar as blocks of their own, with the sentence the checklist asks for. The Text and the FieldError come before the Popover in the tag tree, so the numbers read from the top down.
- `/ui/calendar` passes axe on the whole article here, with no exclusion of `.props-table`. The e2e flow has none.
- A date or a time outside `minValue` and `maxValue` marks the field invalid and shows the FieldError, but does not stop a submit (the hidden input checks only `required`). The form demos look for `data-invalid` before they send, and the pages say so.

## Part bugs found in Chrome (not fixed here)

- DateField and the field of a DatePicker do not show the kept date after a refused write that comes from typing or the arrow keys. ui-refused-write-sync fixed TimeField and DateRangePicker, but not DateField: its `dateSegments` keeps the typed parts and the effect that follows `value` does not run when the setter refuses. With a locked `$bind(signal, request)`, ArrowUp on the month of a DateField shows 12/15/2026 while the signal holds 2026-10-15, and a reset leaves it there. A DatePicker shows the kept date after a pick in its Calendar and after a reset, but not after typing. The pages say what main does (DateField, DatePicker, and the sentence in state.md). Whoever fixes it removes those sentences. The node `date-field-sync` fixes it, with the locale change and the min/max check on submit.
- The segments of DateField, DatePicker and DateRangePicker do not follow a change of `locale` of an I18nProvider after the first render (`locale.locale` is read once in `dateSegments`). Calendar, RangeCalendar and TimeField follow it.
- A Calendar cell has no `data-hovered`, and a DateSegment has no `data-hovered` or `data-focus-visible`. The pages say to use `:hover` and `data-focused`.

## Checked in Chrome

- Calendar: a click and ArrowRight with Enter pick, a locked `$bind` request keeps the date, Clear both signals empties the grids, Monday and a taken day are not picked, a pick in the second month works, and `de-DE`, `ja-JP` and `en-US` change the names, the first day and the labels (`Donnerstag, 15. Oktober 2026`).
- RangeCalendar: two clicks make a range and call `onChange`, a locked request keeps its range, a range that starts before a taken day cannot reach past it, and the nights are right.
- DateField, TimeField: typed digits, `a` and `p`, a locked request, a reset (the signal and the segments for the unlocked fields), the empty-segment placeholders, and the required message of the browser.
- DatePicker and DateRangePicker: opening from outside with `isOpen=$bind`, Escape, a pick that closes and gives focus back, a locked request after a pick, a typed Monday that is invalid and blocks the form, a reversed range, a reset, and the Button named `Kalender` under `de-DE`.

## Stubs left

- None.
