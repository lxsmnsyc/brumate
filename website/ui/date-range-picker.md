# DateRangePicker

Two date fields and a button that opens a RangeCalendar.

```brm demo DateRangePickerDemo

```

```html
<DateRangePicker value=$bind(stay)>
  <Label>Stay</Label>
  <Group>
    <DateInput slot="start" />
    <span aria-hidden="true">–</span>
    <DateInput slot="end" />
    <Button>▾</Button>
  </Group>
  <Popover>
    <Dialog>
      <RangeCalendar>
        <CalendarGrid />
      </RangeCalendar>
    </Dialog>
  </Popover>
</DateRangePicker>
```

- A `DateRangePicker` holds a `Label`, a `Group` with a `DateInput` with `slot="start"`, one with `slot="end"` and a `Button`, and a `Popover` with a `Dialog` and a [RangeCalendar](./range-calendar.md). A `Text` with `slot="description"` and a `FieldError` work as in a [DateField](./date-field.md).
- `value` is the range as `{ start, end }` of `YYYY-MM-DD` dates, or null until both dates are set. It starts its own state, or binds with `$bind`. See [State](./state.md).
- A date that is only typed so far stays in its input while the value is null.
- `onChange` gets each change, whether it is typed or picked.
- `startName` and `endName` post the dates with a form, from hidden inputs. `isRequired` asks the browser to check them on a submit, and the FieldError shows the message. A reset of the form gives back the first range.
- It shows `data-open`, `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## The RangeCalendar

- The Button opens the Popover. The RangeCalendar shows the range, and its start takes focus, or `placeholderValue` when there is no range.
- A Dialog with no Heading is named by the Button and the Label. The Group is named by the Label and described as the field is.
- A range picked there sets both dates and closes the Popover, and focus goes back to the Button. `shouldCloseOnSelect={false}` keeps it open.
- The RangeCalendar follows `minValue`, `maxValue` and `isDateUnavailable` of the picker, unless it has its own.
- `isOpen` is whether the Popover shows. It starts its own state, or binds with `$bind`, and `onOpenChange` gets each change.

## Validation

- A start after the end makes the range invalid.
- So do `minValue`, `maxValue` and `isDateUnavailable`, for either date, as in a DateField.
- The errors of a [Form](./form.md) for `startName` or `endName` show in the FieldError.
