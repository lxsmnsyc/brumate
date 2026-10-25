# Form

A `<form>` that tells its fields how to validate, and gives them the errors of the server.

```brm demo FormDemo

```

- `validationBehavior` is the default of its fields. See [Validation](./text-field.md#validation).
- `validationErrors` holds errors by the name of a field, such as `{ email: 'This email has an account' }`. A field shows them until the user edits it.
- It takes the attributes of a `<form>`, such as `action`, so it posts without scripts.
