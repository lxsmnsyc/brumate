# RangeCalendar

A grid of the days of a month, to pick a range of dates.

```brm demo RangeCalendarDemo

```

```html
<RangeCalendar aria-label="Stay" value=$bind(stay)>
  <header>
    <Button slot="previous">‹</Button>
    <CalendarHeading />
    <Button slot="next">›</Button>
  </header>
  <CalendarGrid />
</RangeCalendar>
```

- A `RangeCalendar` holds the same parts as a [Calendar](./calendar.md): a `CalendarHeading`, two Buttons with `slot="previous"` and `slot="next"`, and a `CalendarGrid` for each month that shows.
- `value` is the selected range, as `{ start, end }` of `YYYY-MM-DD` dates, or null. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each range that is picked.
- The other props are those of Calendar, such as `minValue`, `maxValue`, `isDateUnavailable` and `visibleDuration`.

## Anatomy

```brm anatomy RangeCalendarAnatomy
`RangeCalendar`: The grid and its range. It shows `data-disabled` and `data-invalid`.
`CalendarHeading`: Shows the months, such as `October 2026`. Optional.
`Button` with `slot="previous"`: Shows the months before.
`Button` with `slot="next"`: Shows the months after.
`CalendarGrid`: The days of one month, as a table.
`CalendarCell`: One date. It shows `data-selected`, and `data-selection-start` or `data-selection-end` at the ends of the range. Optional.
```

```html
<RangeCalendar>
  <CalendarHeading />
  <Button slot="previous" />
  <Button slot="next" />
  <CalendarGrid>
    <CalendarCell />
  </>
</>
```

The `CalendarCell` elements are optional. See [Calendar](./calendar.md) for the props of `CalendarGrid`, `CalendarCell` and `CalendarHeading`.

## Props

```props RangeCalendar

```

The other props, such as `minValue`, `maxValue`, `isDateUnavailable`, `visibleDuration`, `isDisabled` and `firstDayOfWeek`, are those of [Calendar](./calendar.md#props).

## Data attributes

The Calendar and its cells set the attributes of a [Calendar](./calendar.md#data-attributes). A range adds two to the cells.

| Attribute              | When                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `data-selected`        | The date is in the range.                                                         |
| `data-selection-start` | The date is the first one of the range.                                           |
| `data-selection-end`   | The date is the last one of the range.                                            |
| `data-invalid`         | The date is past the nearest date that cannot be picked, or the range is invalid. |

## Keyboard

The keys are those of a [Calendar](./calendar.md#keyboard). In a range, these differ.

| Key                | Action                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` or `Space` | Starts a range at the date that has focus, then moves focus to the next date, or the one before. A second press ends the range. |
| `Escape`           | Drops a range that is not done. The range that was selected shows again.                                                        |

Between the first press and the second, every key that moves focus also moves the end of the range that shows.

The dates use the Gregorian calendar. Names and numbers follow the locale.

## Controlled and uncontrolled

`value` holds the selected range as `{ start, end }` of `YYYY-MM-DD` dates, or `null`. How you pass it picks who keeps it. Pick a range in each calendar, then use the buttons under them:

```brm demo RangeCalendarStateDemo

```

- `value` alone, or nothing, makes the calendar keep its own range. The first value is where that range starts. Pick another and the calendar keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the calendar follows. Clear both signals above to see it.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and pick a range in the last calendar: the signal and the selection stay.
- `onChange` gets the range as `{ start, end }` in every shape, each time a range is done. The first press of a range changes nothing yet.
- A RangeCalendar is not a form field: a `reset` of the form leaves it as it is, and it posts nothing. Set your signal yourself on a reset, or use a [DateRangePicker](./date-range-picker.md).
- The server renders the range it starts with.

See [State](./state.md) for the other parts.

## Styling

Style the dates with `data-selected`, `data-selection-start` and `data-selection-end`, and the other data attributes of a [Calendar](./calendar.md#data-attributes). See [Styling](./styling.md).

A cell has no `data-hovered`, so use `:hover` for the pointer. This stylesheet draws the range as a band with round ends, and styles a date in rest, hover, press, today, keyboard focus, unavailable and out of range. The 22nd is taken, so a range that starts before it stops there.

```brm styled RangeCalendarStyled

```

## Picking a range

- A first press, or Enter or Space, starts a range at a date. A second one ends it, before or after the first.
- A press of the pointer on a date and a release on another one select the range between them.
- In between, the dates show the range to the date under the pointer, or to the date that has focus. The date under the pointer takes the focus.
- The range reaches up to the nearest dates that cannot be picked. The dates past them show `data-invalid` and cannot be picked or focused, and the Calendar is not invalid until the range is done. `isDateUnavailable` gets the first date of the range as its second argument.
- A range cannot hold a date that `isDateUnavailable` marks. `allowsNonContiguousRanges` lets it, and those dates do not show as selected.

## Cells

- A date in the range shows `data-selected`. The first date shows `data-selection-start`, and the last `data-selection-end`.
- The cells show the other states of a Calendar cell. See [Cells](./calendar.md#cells).

## Use cases

### A stay over two months

Two `CalendarGrid`s show two months, and `isDateUnavailable` marks the nights that are taken. A range stops before them, and the dates past them cannot be picked. `onChange` or the signal gives the range, and the nights are the difference of the dates.

```brm demo RangeCalendarStayDemo

```

### A range in the language of the user

An [I18nProvider](./i18n-provider.md) gives the names, the first day of the week and the words that a screen reader hears. Change the language below:

```brm demo RangeCalendarLocaleDemo

```
