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

## Anatomy

```brm anatomy DateRangePickerAnatomy
`DateRangePicker`: The picker and its state. It shows `data-open`, `data-invalid` and the states of a DateField.
`Label`: Names the group, and the Button that opens the Popover.
`Group`: Holds the two inputs and the Button. It is named by the Label.
`DateInput` with `slot="start"`: The segments of the first date.
`DateInput` with `slot="end"`: The segments of the last date.
`Button`: Opens the Popover.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the message of an invalid range. Optional.
`Popover`: The layer that holds the RangeCalendar.
`Dialog`: The `dialog` that takes focus when the Popover opens.
`RangeCalendar`: The dates. A range picked there sets both inputs and closes the Popover.
```

The picture draws the Popover in place, open, as a block of its own under the field, so that each layer can carry a number. The real Popover opens in a layer at the end of the page.

```html
<DateRangePicker>
  <Label />
  <Group>
    <DateInput slot="start" />
    <DateInput slot="end" />
    <Button />
  </>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <Dialog>
      <RangeCalendar />
    </>
  </>
</>
```

The `Label`, the description `Text` and the `FieldError` are optional.

## Props

```props DateRangePicker

```

## Data attributes

| Attribute       | When                                                            |
| --------------- | --------------------------------------------------------------- |
| `data-open`     | The Popover shows.                                              |
| `data-disabled` | The picker is disabled.                                         |
| `data-readonly` | The picker is read only.                                        |
| `data-invalid`  | The picker is invalid, such as when its start is after its end. |
| `data-required` | The picker is required.                                         |

The segments take the keys of a [DateField](./date-field.md#keyboard), and the RangeCalendar takes the keys of a [RangeCalendar](./range-calendar.md#keyboard). `Escape` closes the Popover.

## Controlled and uncontrolled

`value` holds the range as `{ start, end }` of `YYYY-MM-DD` dates, or `null` until both dates are set, and `isOpen` holds whether the Popover shows. How you pass them picks who keeps them. Change a picker below and use the buttons under them:

```brm demo DateRangePickerStateDemo

```

- `value` alone, or nothing, makes the picker keep its own range. The first value is where that range starts. Type or pick another and the picker keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and both inputs follow. `isOpen=$bind(signal)` does the same for the Popover: the first Button under the pickers opens and closes the third one.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and change the last picker, by typing or by a pick: both inputs show the range that you keep.
- `onChange` gets the range, or `null`, in every shape, typed or picked, each time the range changes. With a request that refuses, it still gets the range that was asked for. `onOpenChange` gets each change of `isOpen`.
- A reset of the form gives back the first range, as a write: with `$bind(signal, request)`, your request can refuse it, and the inputs show the range that you keep. The Popover is not a form field, so a reset does not close it. The server renders the range it starts with, and the Popover closed.

See [State](./state.md) for the other parts.

## Styling

Style the picker with the data attributes above, and the parts inside it with their own. See [DateField](./date-field.md), [RangeCalendar](./range-calendar.md), [Popover](./popover.md) and [Styling](./styling.md).

The Popover is a layer outside the form, so put the custom properties of the example on its class too. A segment and a date have no `data-hovered`, so use `:hover` for the pointer. This stylesheet draws the Group as the box with two inputs and a trigger, the layer that fades while it opens and closes, and the range as a band with round ends. The 22nd is taken, and the dates before the 5th of October and after the 20th of November are out of range. Press Save with no dates to see the error.

```brm styled DateRangePickerStyled

```

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

## Use cases

### A stay in a booking form

`startName` and `endName` post the two dates, `isRequired` makes the browser check them, and `minValue` and `maxValue` limit both inputs and the RangeCalendar. Type an end before the start, and the range is invalid. An invalid range does not stop a submit, so the form here looks for `data-invalid` before it sends. Reset gives back the first range.

```brm demo DateRangePickerBookingDemo

```

### A range in the language of the user

An [I18nProvider](./i18n-provider.md) gives the order and the placeholders of the segments, the names of the days and months, and the name of the Button. Two providers give two locales to one signal.

```brm demo DateRangePickerLocaleDemo

```
