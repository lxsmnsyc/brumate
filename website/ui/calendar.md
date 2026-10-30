# Calendar

A grid of the days of a month, to pick a date.

```brm demo CalendarDemo

```

```html
<Calendar aria-label="Delivery date" value=$bind(date)>
  <header>
    <Button slot="previous">‹</Button>
    <CalendarHeading />
    <Button slot="next">›</Button>
  </header>
  <CalendarGrid />
</Calendar>
```

- A `Calendar` holds a `CalendarHeading`, two Buttons with `slot="previous"` and `slot="next"`, and a `CalendarGrid` for each month that shows.
- `value` is the selected date as a `YYYY-MM-DD` string, or null. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each date that is picked. `onFocusChange` gets each date that gets focus.
- The Calendar is named by its `aria-label` and the months that show, such as `Delivery date, October 2026`.
- It shows `data-disabled` and `data-invalid`.

## Anatomy

```brm anatomy CalendarAnatomy
`Calendar`: The grid and its state. It shows `data-disabled` and `data-invalid`.
`CalendarHeading`: Shows the months, such as `October 2026`. Optional.
`Button` with `slot="previous"`: Shows the months before.
`Button` with `slot="next"`: Shows the months after.
`CalendarGrid`: The days of one month, as a table.
`CalendarCell`: One date. Optional, since the grid renders one for each date.
```

```html
<Calendar>
  <CalendarHeading />
  <Button slot="previous" />
  <Button slot="next" />
  <CalendarGrid>
    <CalendarCell />
  </>
</>
```

The `CalendarCell` elements are optional, since the CalendarGrid renders one for each date. The `CalendarHeading` is optional. A Calendar that shows several months holds a `CalendarGrid` for each.

## Props

### Calendar

```props Calendar

```

### CalendarGrid

```props CalendarGrid

```

### CalendarCell

```props CalendarCell

```

### CalendarHeading

```props CalendarHeading

```

## Data attributes

### Calendar

| Attribute       | When                                                            |
| --------------- | --------------------------------------------------------------- |
| `data-disabled` | The Calendar is disabled.                                       |
| `data-invalid`  | The Calendar is invalid, or the selected date cannot be picked. |

### CalendarCell

The attributes are on the button inside the cell.

| Attribute                    | When                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `data-date`                  | Always. The value is the date as `YYYY-MM-DD`.                                                                  |
| `data-selected`              | The date is selected, or is in the selected range.                                                              |
| `data-selection-start`       | The date is the first one of the selection.                                                                     |
| `data-selection-end`         | The date is the last one of the selection.                                                                      |
| `data-focused`               | The date is the one that has focus, and focus is in the Calendar.                                               |
| `data-focus-visible`         | The date has focus and the focus shows as a ring.                                                               |
| `data-pressed`               | A pointer is held down on it.                                                                                   |
| `data-today`                 | The date is today, in the `timeZone` of the Calendar or of the I18nProvider, else the one of the browser.       |
| `data-disabled`              | The Calendar is disabled, the date is outside the month of its grid, or it is out of `minValue` and `maxValue`. |
| `data-unavailable`           | `isDateUnavailable` returns true for the date.                                                                  |
| `data-outside-month`         | The date is outside the month of its grid.                                                                      |
| `data-outside-visible-range` | The date is outside the months that show.                                                                       |
| `data-invalid`               | The date is in an invalid selection, or in a range it cannot reach.                                             |

## Keyboard

The keys act in the CalendarGrid, on the date that has focus. A key with Ctrl, Alt or Meta is left to the browser. An arrow key with Shift moves nothing.

| Key                | Action                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the Buttons, then to the date that has focus. Only that date is a tab stop.  |
| `ArrowRight`       | Moves focus to the next day. Right to left, it moves to the day before.                     |
| `ArrowLeft`        | Moves focus to the day before. Right to left, it moves to the next day.                     |
| `ArrowDown`        | Moves focus to the same day of the next week.                                               |
| `ArrowUp`          | Moves focus to the same day of the week before.                                             |
| `PageDown`         | Moves focus one unit of `visibleDuration` ahead, such as one month for `{ months: 2 }`.     |
| `PageUp`           | Moves focus one unit of `visibleDuration` back.                                             |
| `Shift + PageDown` | Moves focus a year ahead.                                                                   |
| `Shift + PageUp`   | Moves focus a year back.                                                                    |
| `Home`             | Moves focus to the first day of the month.                                                  |
| `End`              | Moves focus to the last day of the month.                                                   |
| `Enter` or `Space` | Selects the date that has focus.                                                            |
| `Escape`           | Drops the first date of a range that is not done. It is not prevented, so a Popover closes. |

The Calendar has `role="application"`, and a hidden Next button follows the grids for screen readers that read by touch. The dates, the weeks and the keys use the Gregorian calendar. Names and numbers follow the locale, but the year is the Gregorian one, so `th-TH` shows 2026 and not 2569.

## Controlled and uncontrolled

`value` holds the selected date as `YYYY-MM-DD`, or `null`. How you pass it picks who keeps it. Pick a date in each calendar, then use the buttons under them:

```brm demo CalendarStateDemo

```

- `value` alone, or nothing, makes the Calendar keep its own date. `value="2026-10-15"` is where that date starts. Pick another and the Calendar keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the Calendar follows. Clear both signals above to see it.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and pick a date in the last calendar: the signal and the selection stay.
- `onChange` gets the date as `YYYY-MM-DD` in every shape, each time a date is picked. It does not run when the same date is picked again.
- `focusedValue` holds the date that has focus in the same way, and `onFocusChange` gets each date that gets focus. A new `focusedValue` moves the months only when its date is outside the ones that show.
- A Calendar is not a form field: a `reset` of the form leaves it as it is, and it posts nothing. Set your signal yourself on a reset, or use a [DateField](./date-field.md).
- The server renders the date it starts with.

See [State](./state.md) for the other parts.

## Styling

Style the dates with the data attributes above. The grid is a table, so style its `th` and `td`. The CalendarHeading is an `h2`, and the Buttons with `slot="previous"` and `slot="next"` are those of [Button](./button.md). See [Styling](./styling.md).

A cell shows `data-hovered` under a mouse or a pen. This stylesheet styles the month Buttons and a date in rest, hover, press, today, selected, keyboard focus, unavailable and out of range. The weekends cannot be picked, and the dates before the 5th of October and after the 20th of November are out of range.

```brm styled CalendarStyled

```

## Dates

- `minValue` and `maxValue` limit the dates. The Buttons stop at them.
- `isDateUnavailable` is a function that gets a date and returns true for a date that cannot be picked, such as a weekend.
- `isDisabled` disables the whole Calendar. `isReadOnly` keeps the value but lets focus move.
- `isInvalid` marks the selected date as invalid.
- The days of the week, the names of the months and the first day of the week follow the locale of an [I18nProvider](./i18n-provider.md). `firstDayOfWeek`, such as `"mon"`, starts each week on another day.
- The words that a screen reader hears follow the locale too: the `aria-label` of the Buttons with `slot="previous"` and `slot="next"`, and the cell labels, such as `Heute, Donnerstag, 15. Oktober 2026` and its `ausgewählt`.
- Today comes from `timeZone`, such as `"Asia/Tokyo"`, or from the `timeZone` of the I18nProvider. The server renders its own date, in that time zone, so the first render of the browser matches the HTML. Without a time zone, the browser then takes its own date. It checks again when the tab shows and at each new minute, so the highlight moves at midnight.
- A `Text` with `slot="errorMessage"` describes the dates of an invalid value, which name it in `aria-describedby`.

## Months

- `visibleDuration` is how much shows, such as `{ months: 2 }`. Give each month a CalendarGrid, and an `offset`, such as `offset=({ months: 1 })` for the second.
- The Buttons move by all the months that show, or by one unit of `visibleDuration` with `pageBehavior="single"`.
- The CalendarHeading shows the months, such as `October 2026`. Children replace that text.

- Focus that leaves the months that show moves them with it.

## Cells

- A `CalendarGrid` renders a `CalendarCell` for each date. Pass `cell`, a `#template` that gets the date, to render your own:

```html
<CalendarGrid cell=day />

#template day(date) {
  <CalendarCell date=date>{Number(date.slice(8))}.</CalendarCell>
}
```

- Only the date that has focus is in the order of Tab.
- A date of another month is hidden and disabled.
- A cell shows `data-focused` while focus is in its grid. It shows `data-selected`, `data-focus-visible`, `data-today`, `data-disabled`, `data-unavailable`, `data-outside-month`, `data-outside-visible-range`, `data-invalid` and `data-pressed`.

## Use cases

### A calendar in the language of the user

An [I18nProvider](./i18n-provider.md) gives the names of the days and months, the first day of the week and the words that a screen reader hears. The `aria-label` stays your own text. Change the language below:

```brm demo CalendarLocaleDemo

```

### Two months and days that are taken

`visibleDuration` shows two months, with a `CalendarGrid` for each and an `offset` on the second. `isDateUnavailable` marks the days that are taken, `minValue` and `maxValue` limit the months, and `firstDayOfWeek` starts the weeks on Monday.

```brm demo CalendarBookingDemo

```
