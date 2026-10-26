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

## Dates

- `minValue` and `maxValue` limit the dates. The Buttons stop at them.
- `isDateUnavailable` is a function that gets a date and returns true for a date that cannot be picked, such as a weekend.
- `isDisabled` disables the whole Calendar. `isReadOnly` keeps the value but lets focus move.
- `isInvalid` marks the selected date as invalid.
- The days of the week, the names of the months and the first day of the week follow the locale of an [I18nProvider](./i18n-provider.md).

## Months

- `visibleDuration` is how much shows, such as `{ months: 2 }`. Give each month a CalendarGrid, and an `offset`, such as `offset=({ months: 1 })` for the second.
- The Buttons move by all the months that show, or by one with `pageBehavior="single"`.
- The CalendarHeading shows the months, such as `October 2026`.

## Keys

- The arrow keys move focus by a day and by a week. Right to left, Left and Right swap.
- PageUp and PageDown move by a month, or by a year with Shift.
- Home and End go to the start and the end of the month.
- Enter and Space select the date that has focus.
- Focus that leaves the months that show moves them with it.

## Cells

- A `CalendarGrid` renders a `CalendarCell` for each date. Pass `cell`, a `#template` that gets the date, to render your own:

```html
<CalendarGrid cell=day />

#template day(date: string) {
  <CalendarCell date=date>{Number(date.slice(8))}.</CalendarCell>
}
```

- Only the date that has focus is in the order of Tab.
- A date of another month is hidden and disabled.
- A cell shows `data-selected`, `data-focused`, `data-focus-visible`, `data-today`, `data-disabled`, `data-unavailable`, `data-outside-month`, `data-outside-visible-range`, `data-invalid` and `data-pressed`.
