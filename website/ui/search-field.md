# SearchField

A search input with a button that clears it.

```brm demo SearchFieldDemo

```

- Enter calls `onSubmit` with the value. Escape and the button clear it, and call `onClear`.
- The button is out of the order of Tab, since Escape clears the field too.
- `value` is the text. See [State](./state.md).
- It holds a `Label`, an `Input`, a `Text` with `slot="description"` and a `Button`, and names them for each other, as a [TextField](./text-field.md) does.
- The element shows `data-empty` while the field is empty, and `data-disabled`.
