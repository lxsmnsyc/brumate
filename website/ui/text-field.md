# TextField

A field of a `Label`, an `Input` or a `TextArea`, a description and a `FieldError`. It gives each part its ID, so the label names the input, and the description and the errors describe it.

```brm demo TextFieldDemo

```

- `value` is the text. See [State](./state.md).
- `name`, `type`, `isRequired`, `minLength`, `maxLength`, `pattern`, `autoComplete`, `inputMode` and `placeholder` go to the input.
- `isDisabled`, `isReadOnly` and `isInvalid` set the state of the field and its input.
- The element shows `data-disabled`, `data-invalid`, `data-readonly` and `data-required`.

## Anatomy

```html
<TextField>
  <Label />
  <Input />
  <Text slot="description" />
  <FieldError />
</>
```

Use a `TextArea` in place of the `Input` for several lines. The `Text` and the `FieldError` are optional.

## Props

### TextField

```props TextField

```

### Input

```props Input

```

### TextArea

```props TextArea

```

### Label

```props Label

```

### Text

```props Text

```

### FieldError

```props FieldError

```

An `Input` or a `TextArea` takes the attributes of its element, and those that you pass come last.

## Data attributes

### TextField

| Attribute       | When                    |
| --------------- | ----------------------- |
| `data-disabled` | The field is disabled.  |
| `data-invalid`  | The field has errors.   |
| `data-readonly` | The field is read only. |
| `data-required` | The field is required.  |

### Input and TextArea

| Attribute            | When                         |
| -------------------- | ---------------------------- |
| `data-hovered`       | A mouse or a pen is over it. |
| `data-focused`       | It has focus.                |
| `data-focus-visible` | Its focus shows as a ring.   |
| `data-disabled`      | It is disabled.              |
| `data-invalid`       | The field has errors.        |

### FieldError

| Attribute      | When                                             |
| -------------- | ------------------------------------------------ |
| `data-invalid` | It renders, which is while the field is invalid. |

## Keyboard

| Key     | Action                                                                          |
| ------- | ------------------------------------------------------------------------------- |
| `Tab`   | Moves focus to the input. A disabled input is skipped.                          |
| `Enter` | Sends the form of the field, as the browser does. A `TextArea` adds a new line. |

## Controlled and uncontrolled

`value` holds the text. `value=(text)` starts the field's own value, and `value=$bind(signal)` writes your signal. `onChange` gets the text each time the user edits it. A reset of the form gives back the first value. See [State](./state.md).

## Styling

Style the field, its input and its error with the data attributes above, such as `[data-invalid]`. See [Styling](./styling.md).

## Validation

With the default `validationBehavior="native"`, the browser checks the field when its form is sent:

- The `FieldError` shows the message of the browser, and the browser's own bubble does not show.
- The first invalid field of the form gets focus.
- After that, the message follows what the user types.
- `validate` sets a message of your own, such as for a value that the input's attributes cannot check.

With `validationBehavior="aria"`, `validate` shows its errors at once, and the form is never blocked:

```brm demo ValidateDemo

```

A [Form](./form.md) sets the default for its fields, and gives them the errors of the server.

## With createForm

`field` takes a field of [`createForm`](../docs/forms.md#forms-with-createform): its name, ID, posted value and errors, and the ID and `role="alert"` of its error.

```html
<form action=save {...attrs}>
  <TextField field=(fields.email) type="email">
    <Label>Email</Label>
    <Input />
    <FieldError />
  </TextField>
</form>
```

## Label, Text and FieldError

- `Label` is a `<label>` with the ID and the `for` that its field gives.
- `Text` with `slot="description"` is the description, which the input names in `aria-describedby`. A field without one leaves its ID out once the browser is idle.
- `FieldError` renders only while its field is invalid. Without children, it shows the messages.
