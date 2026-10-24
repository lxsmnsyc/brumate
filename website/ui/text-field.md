# TextField

A field of a `Label`, an `Input` or a `TextArea`, a description and a `FieldError`. It gives each part its ID, so the label names the input, and the description and the errors describe it.

```brm demo TextFieldDemo

```

- `value` is the text. See [State](./state.md).
- `name`, `type`, `isRequired`, `minLength`, `maxLength`, `pattern`, `autoComplete`, `inputMode` and `placeholder` go to the input.
- `isDisabled`, `isReadOnly` and `isInvalid` set the state of the field and its input.
- The element shows `data-disabled`, `data-invalid`, `data-readonly` and `data-required`.

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

## Input and TextArea

The input of a field. They take the attributes and the value that the field gives, and show `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-invalid`. Attributes that you pass to them come last.

## Label, Text and FieldError

- `Label` is a `<label>` with the ID and the `for` that its field gives.
- `Text` with `slot="description"` is the description, which the input names in `aria-describedby`. A field without one leaves its ID out once the browser is idle.
- `FieldError` renders only while its field is invalid. Without children, it shows the messages.
