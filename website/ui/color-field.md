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
- `name` sends the hex as it reads in the input, also before the code of the page loads. A channel field sends the number of the channel, so an alpha input that reads `100%` sends `1`.
- A reset of the form gives back the first value.
- `isRequired` asks the browser to check the field on a submit, and the `FieldError` shows the message.
- It shows `data-channel`, which is `hex` without a channel, and `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## Anatomy

```brm anatomy ColorFieldAnatomy
`ColorField`: The field. It shows `data-channel`, `data-invalid` and the other states.
`Label`: Names the input.
`Input`: Holds the text. The keys step the color, and leaving it commits the text.
`Text` with `slot="description"`: Describes the field. Optional.
`FieldError`: Shows the message of an invalid field. Optional.
```

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

`value` holds a color of CSS, or `null` when the field is empty. How you pass it picks who keeps it. Change a field below and press Reset the form:

```brm demo ColorFieldStateDemo

```

- `value` alone, or nothing, makes the field keep its own color. `value="#f59e0b"` is where that color starts. Type another and the field keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the field follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and type in the last field.
- `onChange` gets the color as text, or `null`, in every shape, each time an edit makes another value.
- A reset of the form gives back the first value, as a write: with `$bind(signal, request)`, your request can refuse it. The server renders the value it starts with.
- With a request that refuses, the ColorField shows the color you keep, and so do its inputs. Press Lock above and use the last one to see it.

See [State](./state.md) for the other parts.

## Styling

Style the field with the data attributes above. The `Input` and the `Label` are the parts of [TextField](./text-field.md). See [Styling](./styling.md).

This stylesheet styles the input in rest, hover, keyboard focus, invalid and disabled, the description and the error, and a swatch beside the field. Clear the first field and press Save to see the error.

```brm styled ColorFieldStyled

```

## Use cases

### Channels of one color

Fields with a `channel` and `colorSpace="rgb"` edit one number each, and the hex field edits all three. They share one `$bind` signal, so a change in one shows in the others.

```brm demo ColorFieldChannelsDemo

```

### A field in a form

`isRequired` makes the browser check the hex field, and the FieldError shows the message. `name` sends the hex as the input reads it, and for a channel field the value of the channel, such as the opacity here. Reset gives back the first values.

```brm demo ColorFieldFormDemo

```

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
