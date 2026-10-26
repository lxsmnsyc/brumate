# RadioGroup

Native radios with one name, from which the user picks one.

```brm demo RadioGroupDemo

```

- Each `Radio` is a `<label>` around a native radio, and names itself with `value`. Draw the circle in the children. See [Styling](./styling.md#boxes).
- `value` is the chosen radio, or `null`. See [State](./state.md).
- The arrow keys move the choice, and Tab stops at the chosen radio, as in every browser, with or without scripts.
- `orientation` sets `aria-orientation`. `isRequired` asks for a choice when the form is sent.
- It is a `radiogroup`, named by its `Label`.
