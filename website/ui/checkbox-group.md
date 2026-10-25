# CheckboxGroup

Checkboxes with one value, the list of the checked ones.

```brm demo CheckboxGroupDemo

```

- Each [Checkbox](./checkbox.md) in the group names itself with `value`.
- `value` is the list. See [State](./state.md).
- With `isRequired`, the browser asks for a box when the form is sent, and a `FieldError` shows the message.
- It is a `group`, named by its `Label` and described by its `Text slot="description"`.
