# ToggleButton

A button that stays pressed, with `aria-pressed` and `data-selected`.

```brm demo ToggleButtonDemo

```

- `isSelected` is its state. See [State](./state.md).
- It takes the props of a [Button](./button.md), and shows its attributes.
- In a [ToggleButtonGroup](./toggle-button-group.md), it names itself with `id`, and the group keeps its state.

## Props

```props ToggleButton

```

## Data attributes

It shows the [data attributes of a Button](./button.md#data-attributes), and:

| Attribute       | When      |
| --------------- | --------- |
| `data-selected` | It is on. |

## Keyboard

| Key                | Action                                            |
| ------------------ | ------------------------------------------------- |
| `Tab`              | Moves focus to the button.                        |
| `Enter` or `Space` | Toggles the button. Space never scrolls the page. |

## Controlled and uncontrolled

`isSelected` holds the state. A plain `isSelected` starts the button's own state, and `isSelected=$bind(signal)` writes your signal. `onChange` gets the new state each time the user toggles the button. A button in a group takes its state from the group, so use the props of the [group](./toggle-button-group.md#controlled-and-uncontrolled) there.

## Styling

Style the button with `[data-selected]` and the attributes above. See [Styling](./styling.md).
