# SearchField

A search input with a button that clears it.

```brm demo SearchFieldDemo

```

- Enter calls `onSubmit` with the value. Escape and the button clear it, and call `onClear`.
- The button is out of the order of Tab, since Escape clears the field too.
- It holds a `Label`, an `Input`, a `Text` with `slot="description"` and a `Button`, and names them for each other, as a [TextField](./text-field.md) does.

## Anatomy

```html
<SearchField>
  <Label />
  <Input />
  <Text slot="description" />
  <Button />
</>
```

The `Label` and the `Text` are optional.

## Props

```props SearchField

```

The [Label, Input and Text](./text-field.md#props) are those of a TextField, and the [Button](./button.md#props) is a Button.

## Data attributes

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-empty`    | The field has no text. |
| `data-disabled` | The field is disabled. |

The input shows the [attributes of an Input](./text-field.md#input-and-textarea), and the button those of a [Button](./button.md#data-attributes).

## Keyboard

| Key      | Action                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `Tab`    | Moves focus to the input. The clear button is skipped.                                                   |
| `Enter`  | Calls `onSubmit` with the text. It sends no form.                                                        |
| `Escape` | Clears the field and calls `onClear`. An empty field does nothing, so Escape reaches a dialog around it. |

A disabled or read-only field does neither.

## Controlled and uncontrolled

`value` holds the text. `value=(text)` starts the field's own value, and `value=$bind(signal)` writes your signal. `onChange` gets the text each time it changes, also when a clear empties it. See [State](./state.md).

## Styling

Style the field with `[data-empty]`, for example to hide the clear button of an empty field. See [Styling](./styling.md).
