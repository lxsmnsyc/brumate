# DatePicker

A DateField with a button that opens a Calendar.

```brm demo DatePickerDemo

```

```html
<DatePicker value=$bind(departure)>
  <Label>Departure</Label>
  <Group>
    <DateInput />
    <Button>▾</Button>
  </Group>
  <Popover>
    <Dialog>
      <Calendar>
        <header>
          <Button slot="previous">‹</Button>
          <CalendarHeading />
          <Button slot="next">›</Button>
        </header>
        <CalendarGrid />
      </Calendar>
    </Dialog>
  </Popover>
</DatePicker>
```

- A `DatePicker` holds a `Label`, a `Group` with a `DateInput` and a `Button`, and a `Popover` with a `Dialog` and a `Calendar`. A `Text` with `slot="description"` and a `FieldError` work as in a [DateField](./date-field.md).
- `value` is the date as a `YYYY-MM-DD` string, or null. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change, whether it is typed or picked.
- The other props are those of DateField, such as `name`, `minValue`, `maxValue` and `isDateUnavailable`.
- It shows `data-open`, and the states of a DateField.

## The Calendar

- The Button opens the Popover. The Calendar shows the date of the field, or `placeholderValue` when the field is empty, and that date takes focus.
- A Dialog with no Heading is named by the Button and the Label. The Group is named by the Label.
- The Calendar follows `isDisabled` and `isReadOnly` of the DatePicker, unless it has its own.
- A pick sets the date and closes the Popover, and focus goes back to the Button. `shouldCloseOnSelect={false}` keeps it open.
- The Calendar follows `minValue`, `maxValue` and `isDateUnavailable` of the DatePicker, unless it has its own.
- Escape closes the Popover.
- `isOpen` is whether the Popover shows. It starts its own state, or binds with `$bind`, and `onOpenChange` gets each change.
