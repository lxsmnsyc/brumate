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

## Segments

- `granularity` is the smallest segment: `hour`, `minute`, the default, or `second`.
- The hour shows on the clock of the locale of an [I18nProvider](./i18n-provider.md): from 1 to 12 with AM and PM in `en-US`, or from 0 to 23 in `de-DE`. `hourCycle` of `12` or `24` picks one.
- A segment that is not set shows `––`, and AM and PM show the period of `placeholderValue`.

## Keys

- Digits type into the hour, the minute and the second, and move on when a segment is full. On a 12-hour clock, the hour keeps its period.
- AM and PM are a segment of their own, which must be set for the field to have a value. A letter that starts the text of AM or PM in the locale sets it, such as `a` and `p` in `en-US`. Backspace empties it.
- ArrowUp and ArrowDown step a segment around the clock. On a 12-hour clock, the hour goes around within AM or PM, so 11 AM goes to 12 AM. On AM and PM, they move the time by 12 hours. An empty segment starts at `placeholderValue`, midnight by default.
- PageUp, PageDown, Home and End work as in a DateField. Home and End on the hour of a 12-hour clock go to 12 and 11.
- `minValue` and `maxValue` compare times by their seconds, so `09:30:00` is not past `09:30`.
- Backspace and ArrowLeft and ArrowRight work as in a DateField.

## Validation

- `minValue` and `maxValue`, such as `"08:00"` and `"18:00"`, limit the time. A time outside them makes the field invalid, as `isInvalid` does.
