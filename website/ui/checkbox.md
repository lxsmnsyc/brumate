# Checkbox

A `<label>` around a native checkbox, which stays for screen readers and forms. The browser toggles it on a click and on Space, with or without scripts.

```brm demo CheckboxDemo

```

- Draw the box in the children. See [Styling](./styling.md#boxes).
- `isIndeterminate` shows that some of a list is selected. Only code can set it on the input, so only an indeterminate box loads any, when the browser is idle.
- `isReadOnly` keeps its state: the click is prevented, so the browser never toggles it.
- `name` and `value` post with the form.

## Props

```props Checkbox

```

## Data attributes

The label shows the state:

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The box is checked.               |
| `data-indeterminate` | The box is indeterminate.         |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | Its input has focus.              |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | The box is disabled.              |
| `data-readonly`      | The box is read only.             |
| `data-invalid`       | The box is invalid.               |
| `data-required`      | The box is required.              |

## Keyboard

| Key     | Action                                             |
| ------- | -------------------------------------------------- |
| `Tab`   | Moves focus to the box. A disabled box is skipped. |
| `Space` | Toggles the box.                                   |

## Controlled and uncontrolled

`isSelected` holds the state. A plain `isSelected` starts the box's own state, and `isSelected=$bind(signal)` writes your signal. `onChange` gets the new state each time the user toggles the box. In a [CheckboxGroup](./checkbox-group.md), the group keeps the state and `value` names the box. See [State](./state.md).

## Styling

Draw the box in the children, from the attributes of the label. See [Styling](./styling.md#boxes).
