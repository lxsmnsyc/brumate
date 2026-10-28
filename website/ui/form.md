# Form

A `<form>` that tells its fields how to validate, and gives them the errors of the server.

```brm demo FormDemo

```

- `validationBehavior` is the default of its fields. See [Validation](./text-field.md#validation).
- `validationErrors` holds errors by the name of a field, such as `{ email: 'This email has an account' }`. A field shows them until the user edits it.
- It takes the attributes of a `<form>`, such as `action`, so it posts without scripts.

## Anatomy

```brm anatomy FormAnatomy
`Form`: The `<form>`. It gives its fields the default validation and the errors of the server.
`TextField`: A field of the form. It finds its errors by `name`.
`Label`: Names the field.
`Input`: The input, which posts under the `name` of its field.
`FieldError`: Shows the error of the server for the field, until the user edits it.
`Button`: Sends the form with `type="submit"`.
```

```html
<Form>
  <TextField>
    <Label />
    <Input />
    <FieldError />
  </>
  <Button type="submit" />
</>
```

A form holds any fields, such as a TextField, a Checkbox, a Select or a RadioGroup, and the buttons that send and reset it.

## Props

```props Form

```

A `Form` takes the attributes of a `<form>` too, and they come last.

## Keyboard

| Key     | Action                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` | In a field, sends the form, as the browser does. A native check of an invalid field stops the send and focuses the first invalid field. |

A pending submit [Button](./button.md) is `type="button"`, so a form with one text field can still send on Enter while it saves. Guard in your submit handler, as the first use case below does.

## Controlled and uncontrolled

A Form keeps no state. Its fields do, each with the shapes of [State](./state.md). A `reset` of the form, from a `type="reset"` Button, gives every field the value that it started with. The Form adds nothing to this: each field listens for the reset. The rules are in [Form reset](./state.md#form-reset), including the fields that do not show a refused reset yet.

## Styling

A Form sets no data attributes. With `validationBehavior="aria"` it sets `novalidate` on the `<form>`. Give it a `class`. Style its fields with their own attributes. See [Styling](./styling.md).

This stylesheet styles a form of fields and buttons: input hover, keyboard focus, an error of the server on the email, a disabled field, and the Save button at rest, hover, press, focus, pending and disabled. Press Save, then press Enter in a field while it saves: the handler ignores the second send.

```brm styled FormStyled

```

## Use cases

### A sign-up form with validation

The browser checks `isRequired`, `type="email"` and `minLength` when the form is sent, and `validate` checks the repeated password. The first invalid field gets focus. The submit handler guards with `if (saving) return`, since a pending Button is not a submit button and Enter in a field sends the form again. A reply with an error is passed back as `validationErrors`, and the field shows it until the user edits the field.

```brm demo FormSignupDemo

```

### A filter bar

Fields bound to signals filter a list as the user types, and the form only holds them together. A `type="reset"` Button gives every field its start value, which writes the signals back.

```brm demo FormFilterBarDemo

```

### A settings panel

Fields with a start value post under their names, and the handler reads them with `FormData`. A switch that is off posts nothing. Change the settings, press Discard changes, and each field goes back.

```brm demo FormSettingsDemo

```
