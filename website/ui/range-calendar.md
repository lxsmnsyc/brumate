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

## Picking a range

- A first press, or Enter or Space, starts a range at a date. A second one ends it, before or after the first.
- In between, the dates show the range to the date under the pointer, or to the date that has focus.
- Escape drops a range that is not done, and the range that was selected shows again.
- A range cannot hold a date that `isDateUnavailable` marks. `allowsNonContiguousRanges` lets it, and those dates do not show as selected.

## Cells

- A date in the range shows `data-selected`. The first date shows `data-selection-start`, and the last `data-selection-end`.
- The cells show the other states of a Calendar cell. See [Cells](./calendar.md#cells).
