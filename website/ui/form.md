# Form

A `<form>` that tells its fields how to validate, and gives them the errors of the server.

```brm demo FormDemo

```

- `validationBehavior` is the default of its fields. See [Validation](./text-field.md#validation).
- `validationErrors` holds errors by the name of a field, such as `{ email: 'This email has an account' }`. A field shows them until the user edits it.
- It takes the attributes of a `<form>`, such as `action`, so it posts without scripts.

## Props

```props Form

```

A `Form` takes the attributes of a `<form>` too, and they come last.

## Keyboard

| Key     | Action                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` | In a field, sends the form, as the browser does. A native check of an invalid field stops the send and focuses the first invalid field. |

## Styling

A Form sets no data attributes. With `validationBehavior="aria"` it sets `novalidate` on the `<form>`. Give it a `class`. Style its fields with their own attributes. See [Styling](./styling.md).
