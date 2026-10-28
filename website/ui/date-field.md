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

```brm anatomy DateFieldAnatomy
`DateField`: The field and its state. It shows `data-invalid`, `data-required` and the other states.
`Label`: Names the group of segments.
`DateInput`: The group that holds the segments and the text between them.
`DateSegment`: One part of the date, here the month. It is editable text with `role="spinbutton"`.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the message of an invalid field. Optional.
```

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

The keys act on the segment that has focus. A segment takes none of them while the field is disabled or read only. A key with Ctrl, Alt or Meta is left to the browser, except `ArrowLeft` and `ArrowRight`, which move focus only without them, so Alt with an arrow stays back and forward in the browser.

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

`value` holds the date as `YYYY-MM-DD`, or `null` until every segment is set. How you pass it picks who keeps it. Change a field below and press Reset the form:

```brm demo DateFieldStateDemo

```

- `value` alone, or nothing, makes the field keep its own date. `value="2026-10-15"` is where that date starts. Type another and the field keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the field follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above, then change the last field: the signal keeps its date.
- `onChange` gets the date, or `null` when a segment is emptied, in every shape, each time the date changes. With a request that refuses, it still gets the date that was asked for.
- With a request that refuses, the segments of a DateField keep the date that was typed, and the signal keeps the date you hold. Press Lock above, press ArrowUp in the last field and see the two differ. The segments follow the signal again at its next change.
- A reset of the form gives back the first date, as a write: with `$bind(signal, request)`, your request can refuse it. The server renders the date it starts with.

See [State](./state.md) for the other parts.

## Styling

Style the segments with `data-type`, `data-placeholder` and `data-focused`, and the field with the other data attributes above. The hidden input that posts the date is out of sight. See [Styling](./styling.md).

A segment has no `data-hovered` or `data-focus-visible`, so use `:hover` and `data-focused`. This stylesheet draws the input as a box with its segments in rest, placeholder, focus, invalid and disabled, and the description and the error. Press Save with no date to see the error.

```brm styled DateFieldStyled

```

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

- A segment that is not set shows its placeholder in the language of the [I18nProvider](./i18n-provider.md), as the date input of a browser does: `mm`, `dd` and `yyyy` in English, `tt`, `mm` and `jjjj` in German. It shows `data-placeholder`. The time segments of a [TimeField](./time-field.md) show `––` in every language.
- The order of the segments and the text between them come from the locale, such as `10/15/2026` in `en-US` and `15.10.2026` in `de-DE`.
- The segments show the Gregorian date in every locale, so `th-TH` shows 2026 and not 2569. The digits follow the locale, such as the Arabic-Indic digits of `ar-SA`, and typing takes the digits `0` to `9`.
- The values are Gregorian dates with no time zone. A day is limited by the month and year that are set, and the year goes from 1 to 9999 and does not wrap. A date that does not fit its month, such as the 31st of a month with 30 days, gives the last day of the month.
- Today, the start of a segment that is not set, is the date in the `timeZone` of the I18nProvider, or else the date of the server that rendered the page.
- A screen reader hears the name of each segment (`Tag`, `Monat`, `Jahr` in German) from `Intl.DisplayNames`, with the English names where the browser has none, and `Empty` in the language for a segment that is not set. These words come from the table of languages, which [I18nProvider](./i18n-provider.md) describes.
- Each segment shows `data-type`, such as `month`, and `data-focused`, `data-readonly`, `data-disabled` and `data-invalid`.

## Input

- A press on the DateInput, or on the text between two segments, focuses the last segment.
- A segment is editable text, so a touch keyboard shows its digits.

## Validation

- `minValue` and `maxValue` limit the date, and `isDateUnavailable` marks dates that cannot be picked. A date outside them makes the field invalid, as `isInvalid` does.
- The errors of a [Form](./form.md) for its `name` show in the FieldError.

## Use cases

### A date in a form

`isRequired` makes the browser check the field on a submit, and the FieldError shows the message. `minValue` and `maxValue` make a date outside them invalid, but they do not stop a submit: the form here looks for `data-invalid` before it sends. `name` posts the date as `YYYY-MM-DD`, and Reset gives back the first date.

```brm demo DateFieldFormDemo

```

### A date in the language of the user

An [I18nProvider](./i18n-provider.md) gives the order of the segments, the text between them, the placeholders and the names that a screen reader hears. Three providers give three locales to one signal. Empty a segment with Backspace to see its placeholder, and note that the value stays `YYYY-MM-DD`:

```brm demo DateFieldLocaleDemo

```
