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

## Anatomy

```html
<DatePicker>
  <Label />
  <Group>
    <DateInput />
    <Button />
  </>
  <Popover>
    <Dialog>
      <Calendar />
    </>
  </>
  <Text slot="description" />
  <FieldError />
</>
```

The `Label`, the description `Text` and the `FieldError` are optional.

## Props

```props DatePicker

```

## Data attributes

| Attribute       | When                                                          |
| --------------- | ------------------------------------------------------------- |
| `data-open`     | The Popover shows.                                            |
| `data-disabled` | The picker is disabled.                                       |
| `data-readonly` | The picker is read only.                                      |
| `data-invalid`  | The picker is invalid, such as when its date is out of range. |
| `data-required` | The picker is required.                                       |

## Keyboard

The segments of the DateInput take the keys of a [DateField](./date-field.md#keyboard), and the Calendar takes the keys of a [Calendar](./calendar.md#keyboard).

| Key                | Action                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus through the segments, then to the Button.                                     |
| `Enter` or `Space` | On the Button, opens the Popover. In the Calendar, picks the date and closes the Popover. |
| `Escape`           | Closes the Popover.                                                                       |

## Controlled and uncontrolled

`value` holds the date as `YYYY-MM-DD`, or `null`. A plain `value` starts the picker's own state, and `value=$bind(signal)` writes your signal. `isOpen` holds whether the Popover shows in the same way, and `onOpenChange` gets each change. `onChange` gets the date each time it changes, typed or picked. See [State](./state.md).

## Styling

Style the picker with the data attributes above, and the parts inside it with their own. See [DateField](./date-field.md), [Calendar](./calendar.md), [Popover](./popover.md) and [Styling](./styling.md).

## The Calendar

- The Button opens the Popover. The Calendar shows the date of the field, or `placeholderValue` when the field is empty, and that date takes focus.
- A Dialog with no Heading is named by the Button and the Label. The Group is named by the Label.
- The Calendar follows `isDisabled` and `isReadOnly` of the DatePicker, unless it has its own.
- A pick sets the date and closes the Popover, and focus goes back to the Button. `shouldCloseOnSelect={false}` keeps it open.
- The Calendar follows `minValue`, `maxValue` and `isDateUnavailable` of the DatePicker, unless it has its own.
- Escape closes the Popover.
- `isOpen` is whether the Popover shows. It starts its own state, or binds with `$bind`, and `onOpenChange` gets each change.
