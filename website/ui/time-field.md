# TimeField

A time of day that the user types segment by segment.

```brm demo TimeFieldDemo

```

```html
<TimeField value=$bind(start)>
  <Label>Start</Label>
  <DateInput />
  <FieldError />
</TimeField>
```

- A `TimeField` holds the same parts as a [DateField](./date-field.md): a `Label`, a `DateInput` of `DateSegment`s, and a `Text` with `slot="description"` and a `FieldError`.
- `value` is the time as `HH:MM`, or `HH:MM:SS` with `granularity="second"`, or null until every segment is set. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change.
- `name` posts the time with a form, from a hidden input. `isRequired` and a reset of the form work as in a DateField.
- It shows `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Anatomy

```brm anatomy TimeFieldAnatomy
`TimeField`: The field and its state. It shows `data-invalid`, `data-required` and the other states.
`Label`: Names the group of segments.
`DateInput`: The group that holds the segments and the text between them.
`DateSegment`: One part of the time, here the hour. It is editable text with `role="spinbutton"`.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the message of an invalid field. Optional.
```

```html
<TimeField>
  <Label />
  <DateInput>
    <DateSegment />
  </>
  <Text slot="description" />
  <FieldError />
</>
```

The `DateSegment` elements are optional, since the DateInput renders one for each part of the time. The `Label`, the description `Text` and the `FieldError` are optional. See [DateField](./date-field.md) for the props of `DateInput` and `DateSegment`.

## Props

```props TimeField

```

## Data attributes

The field sets the same attributes as a [DateField](./date-field.md). Its segments have `data-type` of `hour`, `minute`, `second`, `dayPeriod` or `literal`.

| Attribute       | When                                                         |
| --------------- | ------------------------------------------------------------ |
| `data-disabled` | The field is disabled.                                       |
| `data-readonly` | The field is read only.                                      |
| `data-invalid`  | The field is invalid, such as when its time is out of range. |
| `data-required` | The field is required.                                       |

## Keyboard

The keys act on the segment that has focus. A segment takes none of them while the field is disabled or read only. A key with Ctrl, Alt or Meta is left to the browser, except `ArrowLeft` and `ArrowRight`, which move focus whatever the modifiers.

| Key                     | Action                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                   | Moves focus to the next segment, then out of the field. A disabled field has no tab stop.                                              |
| `0` to `9`              | Types into the hour, the minute or the second. Focus moves to the next segment once no other digit could follow.                       |
| `a` or `p`              | Sets AM or PM, when the text of AM or PM in the locale starts with that letter. Focus moves to the next segment.                       |
| `Backspace` or `Delete` | Takes the last digit away. On a 12-hour clock it empties the hour, and it empties AM and PM. In an empty segment, it moves focus back. |
| `ArrowUp`               | Raises the segment by 1, around its range. On AM and PM, it switches between them. An empty segment starts at `placeholderValue`.      |
| `ArrowDown`             | Lowers the segment by 1, around its range. On AM and PM, it switches between them. An empty segment starts at `placeholderValue`.      |
| `PageUp`                | Raises the hour by 2, and the minute or the second by 15.                                                                              |
| `PageDown`              | Lowers the hour by 2, and the minute or the second by 15.                                                                              |
| `Home`                  | Goes to the least value of the segment. On a 12-hour clock the hour goes to 12 of its period, and AM and PM go to AM.                  |
| `End`                   | Goes to the greatest value of the segment. On a 12-hour clock the hour goes to 11 of its period, and AM and PM go to PM.               |
| `ArrowRight`            | Moves focus to the next segment. Right to left, it moves to the one before.                                                            |
| `ArrowLeft`             | Moves focus to the segment before. Right to left, it moves to the next one.                                                            |

## Controlled and uncontrolled

`value` holds the time as `HH:MM`, or `HH:MM:SS` with `granularity="second"`, or `null` until every segment is set. How you pass it picks who keeps it. Change a field below and press Reset the form:

```brm demo TimeFieldStateDemo

```

- `value` alone, or nothing, makes the field keep its own time. `value="09:30"` is where that time starts. Type another and the field keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the field follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and change the last field: its segments go back to the time that you keep.
- `onChange` gets the time, or `null` when a segment is emptied, in every shape, each time the time changes. With a request that refuses, it still gets the time that was asked for.
- A reset of the form gives back the first time, as a write: with `$bind(signal, request)`, your request can refuse it, and the segments show the time that you keep. The server renders the time it starts with.

See [State](./state.md) for the other parts.

## Styling

Style the segments with `data-type`, `data-placeholder` and `data-focused`, and the field with the data attributes above. See [DateField](./date-field.md) for the attributes of the segments, and [Styling](./styling.md).

A segment has no `data-hovered` or `data-focus-visible`, so use `:hover` and `data-focused`. This stylesheet draws the input as a box with its segments in rest, placeholder, focus, invalid and disabled, and the description and the error. Press Save with no time, or type one outside 8 AM to 6 PM.

```brm styled TimeFieldStyled

```

## Segments

- `granularity` is the smallest segment: `hour`, `minute`, the default, or `second`.
- The hour shows on the clock of the locale of an [I18nProvider](./i18n-provider.md): from 1 to 12 with AM and PM in `en-US`, or from 0 to 23 in `de-DE`. `hourCycle` of `12` or `24` picks one.
- A segment that is not set shows `––`, and AM and PM show the period of `placeholderValue`.
- The order of the segments and the separators come from the locale. The times have no time zone.

## Values

- AM and PM are a segment of their own, which must be set for the field to have a value.
- On a 12-hour clock, the hour keeps its period when it is typed.
- `minValue` and `maxValue` compare times by their seconds, so `09:30:00` is not past `09:30`.

## Validation

- `minValue` and `maxValue`, such as `"08:00"` and `"18:00"`, limit the time. A time outside them makes the field invalid, as `isInvalid` does.

## Use cases

### Opening hours in a form

The `minValue` of the closing time follows the signal of the opening time, so a closing time before it is invalid and the FieldError shows the message. An invalid time does not stop a submit: the form here looks for `data-invalid` before it sends. `name` posts each time as `HH:MM`, and Reset gives back the first times.

```brm demo TimeFieldHoursDemo

```

### A clock in the language of the user

An [I18nProvider](./i18n-provider.md) gives the clock, the order of the segments and the words that a screen reader hears. `hourCycle` picks 12 or 24 hours whatever the locale. The value stays `HH:MM`.

```brm demo TimeFieldClockDemo

```
