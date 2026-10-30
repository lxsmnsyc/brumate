---
'@brumate/ui': patch
---

Fix the date fields. A DateField and the field of a DatePicker show the date that the caller keeps when a `$bind` write is refused, and after a reset. DateField, DatePicker and DateRangePicker follow an I18nProvider locale that changes at run time. A date outside `minValue` or `maxValue` blocks a form submit. CalendarCell shows `data-hovered`, and DateSegment shows `data-hovered` and `data-focus-visible`.
