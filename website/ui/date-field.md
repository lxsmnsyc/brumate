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
- It shows `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

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

- A segment that is not set shows its placeholder, such as `mm`. It shows `data-placeholder`.
- Each segment shows `data-type`, such as `month`, and `data-focused`, `data-readonly`, `data-disabled` and `data-invalid`.

## Keys

- Digits type into a segment. Once no other digit could follow, such as after `12` in a month, focus moves to the next segment.
- Backspace takes the last digit away. In an empty segment, it moves back to the one before.
- ArrowUp and ArrowDown step a segment, around its range. An empty segment starts at `placeholderValue`, today by default.
- ArrowLeft and ArrowRight move between the segments, the other way right to left.
- A segment is editable text, so a touch keyboard shows its digits.

## Validation

- `minValue` and `maxValue` limit the date, and `isDateUnavailable` marks dates that cannot be picked. A date outside them makes the field invalid, as `isInvalid` does.
- The errors of a [Form](./form.md) for its `name` show in the FieldError.
