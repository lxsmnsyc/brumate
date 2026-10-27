# Outcome: docs-colors-dates

## Built

- The 12 pages of Colors and Dates in website/ui follow the props-table contract: color-picker, color-swatch, color-slider, color-area, color-wheel, color-field, color-swatch-picker, calendar, range-calendar, date-field, time-field and date-picker. Each has a `props` block for every part it covers.
- 125 doc comments, comments only, for the props of 20 parts in packages/ui/src: ColorSlider, ColorThumb, ColorPicker, ColorSwatch, ColorArea, ColorWheel, ColorWheelTrack, ColorField, ColorSwatchPicker, ColorSwatchPickerItem, Calendar, CalendarGrid, CalendarCell, CalendarHeading, RangeCalendar, DateField, DateInput, DateSegment, TimeField, DatePicker. No prop of these parts has an empty Description.
- Changeset .changeset/docs-colors-dates.md (patch, @brumate/ui).

Sections per page (A anatomy, P props, D data attributes, K keyboard, C controlled and uncontrolled, S styling). x = written, - = left out on purpose.

| Page                | A   | P   | D   | K   | C   | S   |
| ------------------- | --- | --- | --- | --- | --- | --- |
| color-picker        | x   | x   | -   | -   | x   | x   |
| color-swatch        | -   | x   | -   | -   | -   | x   |
| color-slider        | x   | x   | x   | x   | x   | x   |
| color-area          | x   | x   | x   | x   | x   | x   |
| color-wheel         | x   | x   | x   | x   | x   | x   |
| color-field         | x   | x   | x   | x   | x   | x   |
| color-swatch-picker | x   | x   | x   | x   | x   | x   |
| calendar            | x   | x   | x   | x   | x   | x   |
| range-calendar      | x   | x   | x   | x   | x   | x   |
| date-field          | x   | x   | x   | x   | x   | x   |
| time-field          | x   | x   | x   | x   | x   | x   |
| date-picker         | x   | x   | x   | x   | x   | x   |

Left out: Anatomy for ColorSwatch (single part). Data attributes for ColorPicker (no element) and ColorSwatch (it sets none). Keyboard for ColorPicker and ColorSwatch (no keys). Controlled and uncontrolled for ColorSwatch (no state).

## Deviations

- The old prose stays under the demo and in the sections after Styling, as on the docs-controls and docs-collections pages. Two additions to old prose: date-field and time-field got a bullet each on the locale and the time zone.
- ColorPicker has an Anatomy although it is one part, because the page is about how the parts nest in it.
- RangeCalendar and DatePicker list only their own props. RangeCalendar says the rest are those of Calendar. DatePicker's DateField props (`name`, `isRequired` and so on) reach DateField through `...rest` and are not in its type, so they are not in the table.
- DateRangePicker has its own page that this node does not own. It was not touched.
- Demos are unchanged.

## Stubs left

- None.

## Gotchas

- CalendarHeading has `children` in its type, but renders only the months. The comment says "Not used". Either the prop should go or the heading should render it.
- PageUp and PageDown in a CalendarGrid, and the Buttons with `pageBehavior="single"`, move one unit of `visibleDuration`. Not run in a browser.
- Calendars other than Gregorian are not handled by the code. Dates are Gregorian `YYYY-MM-DD` strings, and the grid is built on `@internationalized/date` Gregorian dates. Month names, day names and numbers come from `DateFormatter(locale)`, so a locale whose default calendar is not Gregorian (such as `th-TH`) may show a year or a month name of that calendar next to a Gregorian grid. The pages do not claim support. Not run.
- Segment placeholders (`mm`, `dd`, `yyyy`, `––`) and the screen reader names (`year`, `month`, `AM/PM`, `Previous`, `Next`, `Calendar`, `Color picker`, `Hue`) are English whatever the locale. The pages say so for the placeholders.
- "Today" (the default `placeholderValue`, `data-today`) is the date in the time zone of the browser. Dates and times have no time zone.
- DateSegment sets `data-focused` with a focus handler on the element, not from the state of the part.
- A key with Shift in a ColorField (not a step) and in a CalendarGrid (arrows) does nothing. The DateSegment checks only Ctrl, Alt and Meta.
- Tab, Enter and Escape rows of DatePicker come from the Button, the Calendar and the Popover. Not run in a browser.
- `Space` in a key cell means the key `" "`, as in the other pages.
- The ColorThumb is described on the color-slider page. A later page must not repeat its comment. The ColorArea and ColorWheel pages repeat only its data attributes.
- DateInput and DateSegment are described on the date-field page. The time-field page links to it.

## Proposed learnings

- Read each Keyboard row against the handler of the part and the part it nests | the keys of a field sit in its DateInput, DateSegment or Button, not in the part that the page is named for | website/ui | no

## Verification

- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx tsdown` in packages/brumate, packages/tsc and packages/language-core, then `npx vite build` (client and ssr) in website: passes; every `props` block resolves.
- readProps on the 20 parts: no empty Description.
- Website tests (`node ../packages/ui/node_modules/vitest/vitest.mjs run`): 9 passed.
- `npx brumate-tsc --noEmit` in packages/ui and in website: exit 0.
- `npx vitest run --maxWorkers=2` in packages/ui: 58 files, 544 passed, 1 expected fail.
- `npx oxlint --quiet`: exit 0. Root `npx oxfmt --check`: passes.
- Not run in a browser: no key row or data attribute was checked live.

## Size

- Estimated M, actual M.
