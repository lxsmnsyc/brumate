# Switch

A native checkbox with `role="switch"`, for a setting that applies at once.

```brm demo SwitchDemo

```

- It is a `<label>` around the input. Draw the switch in the children. See [Styling](./styling.md#boxes).
- `isReadOnly` keeps its state: the click does not toggle it.
- `name` and `value` post with the form.

## Props

```props Switch

```

## Data attributes

The label shows the state:

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The switch is on.                 |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | Its input has focus.              |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | The switch is disabled.           |
| `data-readonly`      | The switch is read only.          |

## Keyboard

| Key     | Action                                                   |
| ------- | -------------------------------------------------------- |
| `Tab`   | Moves focus to the switch. A disabled switch is skipped. |
| `Space` | Toggles the switch.                                      |

## Controlled and uncontrolled

`isSelected` holds the state. A plain `isSelected` starts the switch's own state, and `isSelected=$bind(signal)` writes your signal. `onChange` gets the new state each time the user toggles the switch. See [State](./state.md).

## Styling

Draw the switch in the children, from the attributes of the label. See [Styling](./styling.md#boxes).
