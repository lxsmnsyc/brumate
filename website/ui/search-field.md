# SearchField

A search input with a button that clears it.

```brm demo SearchFieldDemo

```

- Enter calls `onSubmit` with the value. Escape and the button clear it, and call `onClear`.
- The button is out of the order of Tab, since Escape clears the field too.
- It holds a `Label`, an `Input`, a `Text` with `slot="description"` and a `Button`, and names them for each other, as a [TextField](./text-field.md) does.

## Anatomy

```brm anatomy SearchFieldAnatomy
`SearchField`: Holds the parts and shows `data-empty` and `data-disabled`.
`Label`: Names the input.
`Input`: The text, with `type="search"`.
`Text`: Describes the input, with `slot="description"`.
`Button`: Clears the field. It reads "Clear search" and is out of the order of Tab.
```

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

`value` holds the text. How you pass it picks who keeps it:

```brm demo SearchFieldStateDemo

```

- `value` alone, or nothing, makes the field keep its own text. `value="tabs"` is where that text starts, and a new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the input follows. The first button writes "menu" to the third field.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock and type in the last field: the signal keeps the old text, and the input still shows what was typed. Escape and the button also leave that text, since the field does not read the kept value back after a write. A reset of the form puts the kept text back. The core node `bind-read-your-writes` closes this gap.
- `onChange` gets the text in every shape, each time the user changes it, also when a clear empties it and also when your request refuses it.
- A reset of the form gives back the text that the field started with, as a write: with `$bind(signal, request)`, your request can refuse it.
- The server renders the text it starts with. See [State](./state.md).

## Styling

Style the field with `[data-empty]`, for example to hide the clear button of an empty field. See [Styling](./styling.md).

This stylesheet draws the field as a pill with a glass and a clear button. It styles rest, hover, keyboard focus as two bands, empty, with text, and disabled. The pill takes its ring from `:has([data-focus-visible])`, since the ring belongs to the whole field and not to the bare input.

```brm styled SearchFieldStyled

```

## Use cases

### Results on Enter

`onSubmit` gets the text when the user presses Enter, and `onClear` runs on Escape and the button. The page searches on Enter and keeps the last three searches.

```brm demo SearchFieldRecentDemo

```

### Inside a dialog

Escape on a field with text clears it and goes no further, so the dialog stays open. Escape on an empty field reaches the dialog and closes it. Type, press Escape twice, and the dialog closes after the text is gone.

```brm demo SearchFieldDialogDemo

```
