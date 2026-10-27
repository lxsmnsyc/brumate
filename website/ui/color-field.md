# ColorField

A field for a color, as hex or as one channel.

```brm demo ColorFieldDemo

```

```html
<ColorField value=$bind(accent)>
  <Label>Accent</Label>
  <Input />
</ColorField>
<ColorField channel="hue" colorSpace="hsl" value=$bind(accent)>
  <Label>Hue</Label>
  <Input />
</ColorField>
```

- A `ColorField` holds a `Label`, an `Input`, and can hold a `Text` with `slot="description"` and a `FieldError`.
- `value` is a color of CSS, such as `#e2445a`, or `null` when the field is empty. It starts its own state, or binds with `$bind`, and `onChange` gets each change. See [State](./state.md).
- The value keeps the format it was given, such as `hsl(210, 50%, 40%)`, and is hex when it started empty. Editing keeps the alpha of the color.
- A field of a channel edits a color at full precision, and gives back the format of the caller. `value` and `onChange` change only when an edit makes another color, so typed hex in another case, or a blur without typing, changes nothing.
- `name` sends the hex, or the channel value, as it reads in the input, also before the code of the page loads.
- A reset of the form gives back the first value.
- `isRequired` asks the browser to check the field on a submit, and the `FieldError` shows the message.
- It shows `data-channel`, which is `hex` without a channel, and `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Anatomy

```html
<ColorField>
  <Label />
  <Input />
  <Text slot="description" />
  <FieldError />
</>
```

The `Label`, the description `Text` and the `FieldError` are optional.

## Props

```props ColorField

```

## Data attributes

| Attribute            | When                                                      |
| -------------------- | --------------------------------------------------------- |
| `data-channel="hex"` | The field edits the color as hex.                         |
| `data-channel="hue"` | The field edits a channel. The value is the channel name. |
| `data-disabled`      | The field is disabled.                                    |
| `data-readonly`      | The field is read only.                                   |
| `data-invalid`       | The field is invalid.                                     |
| `data-required`      | The field is required.                                    |

## Keyboard

The keys act while the input has focus. A key with Shift, Ctrl, Alt or Meta is left to the browser. A disabled or read only field takes none of them.

| Key         | Action                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `Tab`       | Moves focus to the input. Leaving the input commits the text.                                                   |
| `ArrowUp`   | Raises the hex number by 1, or the channel by a step. An empty field starts at black, or at the least value.    |
| `ArrowDown` | Lowers the hex number by 1, or the channel by a step. An empty field starts at white, or at the greatest value. |
| `PageUp`    | Raises the hex number by 16, or the channel by a page.                                                          |
| `PageDown`  | Lowers the hex number by 16, or the channel by a page.                                                          |
| `Home`      | Goes to `#000000`, or to the least value of the channel.                                                        |
| `End`       | Goes to `#FFFFFF`, or to the greatest value of the channel.                                                     |
| `Enter`     | Commits the text. It is not prevented, so it also submits a form.                                               |

## Controlled and uncontrolled

`value` holds a color of CSS, or `null` when the field is empty. A plain `value` starts the field's own state, and `value=$bind(signal)` writes your signal. `onChange` gets the color as text, or `null`, each time an edit makes another value. Inside a [ColorPicker](./color-picker.md), a field without a `value` reads and writes the color of the picker. A reset of the form gives back the first value. See [State](./state.md).

## Styling

Style the field with the data attributes above. The `Input` and the `Label` are the parts of [TextField](./text-field.md). See [Styling](./styling.md).

## Hex

- Typing keeps only text that can become hex. When focus leaves the input, or on Enter, `abc` becomes `#AABBCC`.
- Text that is not a color reverts. An empty field clears the value to `null`.
- The wheel steps the color while the input has focus, unless `isWheelDisabled`.

## Channel

- `channel` is `red`, `green`, `blue`, `hue`, `saturation`, `lightness`, `brightness` or `alpha`. `colorSpace` picks the space to read the color in.
- The field behaves as a [NumberField](./number-field.md) with the range, the step and the page size of the channel: 0 to 255 for red, 0 to 360 for hue, 0 to 100 for the others, and 0 to 1 by 0.01 for alpha.
- The number shows in the format of the locale, such as `120°` or `50%`.
- A channel cannot be empty, so an empty field reverts.
- An input without a `Label`, `aria-label` or `aria-labelledby` is named by its channel, such as "Hue".

## Names

`aria-label` and `aria-labelledby` on the field name its input. A channel field has the role description "Number field".
