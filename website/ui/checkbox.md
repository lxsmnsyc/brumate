# Checkbox

A `<label>` around a native checkbox, which stays for screen readers and forms. The browser toggles it on a click and on Space, with or without scripts.

```brm demo CheckboxDemo

```

- Draw the box in the children. See [Styling](./styling.md#boxes).
- `isSelected` is its state. See [State](./state.md).
- `isIndeterminate` shows that some of a list is selected. Only code can set it on the input, so only an indeterminate box loads any, when the browser is idle.
- `isReadOnly` keeps its state: the click is prevented, so the browser never toggles it.
- `name` and `value` post with the form.
- The label shows `data-selected`, `data-indeterminate`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.
