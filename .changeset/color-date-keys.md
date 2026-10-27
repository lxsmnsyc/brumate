---
'@brumate/ui': patch
---

Fixes the keys of ColorArea and the date fields, and the names of Gregorian dates.

- In a ColorArea, Home and End set the axis of the focused input to its minimum or maximum, and PageUp and PageDown move that axis, not the other one.
- A DateInput leaves ArrowLeft and ArrowRight with Ctrl, Alt or Meta to the browser.
- The segments, the heading and the cell labels of a Calendar show the Gregorian year and names in locales with another calendar, such as `th-TH`.
- A CalendarHeading shows its children in place of the months.
