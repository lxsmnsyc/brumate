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

`isSelected` holds whether the button is on. How you pass it picks who keeps it:

```brm demo ToggleButtonStateDemo

```

- `isSelected` alone, or nothing, makes the button keep its own state. A plain `isSelected` is where that state starts, so it starts on. Toggle it and the button keeps the new state. A new value from you replaces it.
- `isSelected=$bind(signal)` writes your signal. Change the signal and the button follows.
- `isSelected=$bind(signal, (next) => ...)` asks you first. The button shows what you keep, so a request that you ignore leaves it as it was. Press Lock above and toggle the last two buttons.
- `onChange` gets the new state in every shape.
- A button in a group takes its state from the group, so use the props of the [group](./toggle-button-group.md#controlled-and-uncontrolled) there.
- The server renders the state it starts with. A ToggleButton has no reset handler, so a form reset leaves it as it is. See [State](./state.md).

## Styling

Style the button with `[data-selected]` and the attributes above. See [Styling](./styling.md). A ToggleButton is one element, so this page has no anatomy picture.

This stylesheet styles rest, hover, press, keyboard focus, on and disabled. The ring has two bands, so it shows on the accent fill of an on button.

```brm styled ToggleButtonStyled

```

## Use cases

### Filters

Each filter is a ToggleButton with its own `isSelected=$bind(signal)`. A memo reads the three signals and filters the list. For filters that are one choice among several, use a [group](./toggle-button-group.md).

```brm demo ToggleButtonFilterDemo

```

### Formatting in a toolbar

ToggleButtons in a [Toolbar](./toolbar.md) share one stop of Tab and the arrow keys. A button with only an icon or a letter needs an `aria-label`.

```brm demo ToggleButtonToolbarDemo

```
