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

`value` holds the selected range as `{ start, end }` of `YYYY-MM-DD` dates, or `null`. A plain `value` starts the calendar's own state, and `value=$bind(signal)` writes your signal. `onChange` gets each range that is picked. See [State](./state.md).

## Styling

Style the dates with `data-selected`, `data-selection-start` and `data-selection-end`, and the other data attributes of a [Calendar](./calendar.md#data-attributes). See [Styling](./styling.md).

## Picking a range

- A first press, or Enter or Space, starts a range at a date. A second one ends it, before or after the first.
- A press of the pointer on a date and a release on another one select the range between them.
- In between, the dates show the range to the date under the pointer, or to the date that has focus. The date under the pointer takes the focus.
- The range reaches up to the nearest dates that cannot be picked. The dates past them show `data-invalid` and cannot be picked or focused, and the Calendar is not invalid until the range is done. `isDateUnavailable` gets the first date of the range as its second argument.
- A range cannot hold a date that `isDateUnavailable` marks. `allowsNonContiguousRanges` lets it, and those dates do not show as selected.

## Cells

- A date in the range shows `data-selected`. The first date shows `data-selection-start`, and the last `data-selection-end`.
- The cells show the other states of a Calendar cell. See [Cells](./calendar.md#cells).
