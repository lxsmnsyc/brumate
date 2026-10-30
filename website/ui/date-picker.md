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

```brm anatomy DatePickerAnatomy
`DatePicker`: The picker and its state. It shows `data-open`, `data-invalid` and the states of a DateField.
`Label`: Names the group, and the Button that opens the Popover.
`Group`: Holds the input and the Button. It is named by the Label.
`DateInput`: The segments of the date, as in a [DateField](./date-field.md).
`Button`: Opens the Popover. It is named by the Button and the Label together.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the message of an invalid field. Optional.
`Popover`: The layer that holds the Calendar.
`Dialog`: The `dialog` that takes focus when the Popover opens.
`Calendar`: The dates. A pick sets the date and closes the Popover.
```

The picture draws the Popover in place, open, as a block of its own under the field, so that each layer can carry a number. The real Popover opens in a layer at the end of the page.

```html
<DatePicker>
  <Label />
  <Group>
    <DateInput />
    <Button />
  </>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <Dialog>
      <Calendar />
    </>
  </>
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

`value` holds the date as `YYYY-MM-DD`, or `null`, and `isOpen` holds whether the Popover shows. How you pass them picks who keeps them. Pick a date in each picker, then use the buttons under them:

```brm demo DatePickerStateDemo

```

- `value` alone, or nothing, makes the picker keep its own date. `value="2026-10-15"` is where that date starts. Type or pick another and the picker keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the field follows. `isOpen=$bind(signal)` does the same for the Popover: the first Button under the pickers opens and closes the third one.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and pick a date in the last picker: the field shows the date that you keep, and the Popover closes.
- A date that is typed follows the same rule: with a request that refuses, the segments show the date you keep. Press Lock above and press ArrowUp in the last field: the segments stay.
- `onChange` gets the date, or `null`, in every shape, typed or picked, each time the date changes. `onOpenChange` gets each change of `isOpen`.
- A reset of the form gives back the first date, as a write: with `$bind(signal, request)`, your request can refuse it. The picker renders a [DateField](./date-field.md), which resets with its form. The Popover is not a form field, so a reset does not close it. The server renders the date it starts with, and the Popover closed.

See [State](./state.md) for the other parts.

## Styling

Style the picker with the data attributes above, and the parts inside it with their own. See [DateField](./date-field.md), [Calendar](./calendar.md), [Popover](./popover.md) and [Styling](./styling.md).

The Popover is a layer outside the form, so put the custom properties of the example on its class too. A segment and a date show `data-hovered`. This stylesheet draws the Group as the box, the Button as its trigger, the layer that fades while it opens and closes, and the Calendar in it. The weekends cannot be picked, and the dates before the 5th of October and after the 20th of November are out of range. Press Save with no date to see the error.

```brm styled DatePickerStyled

```

## The Calendar

- The Button opens the Popover. The Calendar shows the date of the field, or `placeholderValue` when the field is empty, and that date takes focus.
- A Dialog with no Heading is named by the Button and the Label. The Group is named by the Label.
- The Calendar follows `isDisabled` and `isReadOnly` of the DatePicker, unless it has its own.
- A pick sets the date and closes the Popover, and focus goes back to the Button. `shouldCloseOnSelect={false}` keeps it open.
- The Calendar follows `minValue`, `maxValue` and `isDateUnavailable` of the DatePicker, unless it has its own.
- Escape closes the Popover.
- `isOpen` is whether the Popover shows. It starts its own state, or binds with `$bind`, and `onOpenChange` gets each change.

## Use cases

### A date in a booking form

`name` posts the date, `isRequired` makes the browser check it, and `minValue`, `maxValue` and `isDateUnavailable` limit the field and the Calendar both. Mondays and two more days are taken: type one, and the field turns invalid. An invalid date does not stop a submit, so the form here looks for `data-invalid` before it sends.

```brm demo DatePickerBookingDemo

```

### A picker in the language of the user

An [I18nProvider](./i18n-provider.md) gives the order and the placeholders of the segments, the names of the days and months, and the name of the Button, which a screen reader hears as `Kalender` in German. Two providers give two locales to one signal.

```brm demo DatePickerLocaleDemo

```
