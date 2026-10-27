# DateField

A date that the user types segment by segment.

```brm demo DateFieldDemo

```

```html
<DateField value=$bind(birthday)>
  <Label>Birthday</Label>
  <DateInput />
  <Text slot="description">Type it, or use the arrow keys.</Text>
  <FieldError />
</DateField>
```

- A `DateField` holds a `Label`, a `DateInput`, and a `Text` with `slot="description"` and a `FieldError`, as a [TextField](./text-field.md) does.
- `value` is the date as a `YYYY-MM-DD` string, or null until every segment is set. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change, and null when a segment is emptied.
- `name` posts the date with a form, from a hidden input, also before the code of the page loads.
- `isRequired` asks the browser to check the field on a submit, and the FieldError shows the message. A reset of the form gives back the first date.
- It shows `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Anatomy

```html
<DateField>
  <Label />
  <DateInput>
    <DateSegment />
  </>
  <Text slot="description" />
  <FieldError />
</>
```

The `DateSegment` elements are optional, since the DateInput renders one for each part of the date. The `Label`, the description `Text` and the `FieldError` are optional.

## Props

### DateField

```props DateField

```

### DateInput

```props DateInput

```

### DateSegment

```props DateSegment

```

## Data attributes

### DateField

| Attribute       | When                                                         |
| --------------- | ------------------------------------------------------------ |
| `data-disabled` | The field is disabled.                                       |
| `data-readonly` | The field is read only.                                      |
| `data-invalid`  | The field is invalid, such as when its date is out of range. |
| `data-required` | The field is required.                                       |

### DateInput

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-disabled` | The field is disabled. |
| `data-invalid`  | The field is invalid.  |

### DateSegment

| Attribute          | When                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `data-type`        | Always. The value is `year`, `month`, `day`, or `literal` for text between segments. |
| `data-placeholder` | The segment is not set, so it shows its placeholder.                                 |
| `data-focused`     | The segment has focus.                                                               |
| `data-readonly`    | The field is read only.                                                              |
| `data-disabled`    | The field is disabled.                                                               |
| `data-invalid`     | The field is invalid.                                                                |

## Keyboard

The keys act on the segment that has focus. A segment takes none of them while the field is disabled or read only. A key with Ctrl, Alt or Meta is left to the browser, except `ArrowLeft` and `ArrowRight`, which move focus whatever the modifiers.

| Key                     | Action                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `Tab`                   | Moves focus to the next segment, then out of the field. A disabled field has no tab stop. |
| `0` to `9`              | Types into the segment. Focus moves to the next segment once no other digit could follow. |
| `Backspace` or `Delete` | Takes the last digit away. In an empty segment, it moves focus to the segment before.     |
| `ArrowUp`               | Raises the segment by 1. An empty segment starts at `placeholderValue`.                   |
| `ArrowDown`             | Lowers the segment by 1. An empty segment starts at `placeholderValue`.                   |
| `PageUp`                | Raises the segment by 5 years, 2 months or 7 days.                                        |
| `PageDown`              | Lowers the segment by 5 years, 2 months or 7 days.                                        |
| `Home`                  | Goes to the least value of the segment.                                                   |
| `End`                   | Goes to the greatest value of the segment.                                                |
| `ArrowRight`            | Moves focus to the next segment. Right to left, it moves to the one before.               |
| `ArrowLeft`             | Moves focus to the segment before. Right to left, it moves to the next one.               |

## Controlled and uncontrolled

`value` holds the date as `YYYY-MM-DD`, or `null` until every segment is set. A plain `value` starts the field's own state, and `value=$bind(signal)` writes your signal. `onChange` gets the date each time it changes, and `null` when a segment is emptied. A reset of the form gives back the first date. See [State](./state.md).

## Styling

Style the segments with `data-type`, `data-placeholder` and `data-focused`, and the field with the other data attributes above. The hidden input that posts the date is out of sight. See [Styling](./styling.md).

## Segments

- The `DateInput` is a group that the Label names. It holds a `DateSegment` for the month, the day and the year, in the order of the locale of an [I18nProvider](./i18n-provider.md), with the text between them.
- Pass `segment`, a `#template` that gets each segment, to render your own:

```html
<script>
  import type { Segment } from '@brumate/ui/segments.ts';
</script>

<DateInput segment=part />

#template part(segment: Segment) {
  <DateSegment segment=segment class="part" />
}
```

- A segment that is not set shows its placeholder in English: `mm`, `dd` or `yyyy`. It shows `data-placeholder`.
- The order of the segments and the text between them come from the locale, such as `10/15/2026` in `en-US` and `15.10.2026` in `de-DE`.
- The values are Gregorian dates with no time zone. A day is limited by the month and year that are set, and the year goes from 1 to 9999 and does not wrap. A date that does not fit its month, such as the 31st of a month with 30 days, gives the last day of the month.
- Today, the start of a segment that is not set, is the date in the time zone of the browser.
- Each segment shows `data-type`, such as `month`, and `data-focused`, `data-readonly`, `data-disabled` and `data-invalid`.

## Input

- A press on the DateInput, or on the text between two segments, focuses the last segment.
- A segment is editable text, so a touch keyboard shows its digits.

## Validation

- `minValue` and `maxValue` limit the date, and `isDateUnavailable` marks dates that cannot be picked. A date outside them makes the field invalid, as `isInvalid` does.
- The errors of a [Form](./form.md) for its `name` show in the FieldError.
