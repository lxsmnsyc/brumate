# ColorSwatchPicker

A list of color swatches, to pick one.

```brm demo ColorSwatchPickerDemo

```

```html
<ColorSwatchPicker aria-label="Color" value=$bind(color)>
  <ColorSwatchPickerItem color="#e2445a"><ColorSwatch /></ColorSwatchPickerItem>
  <ColorSwatchPickerItem color="#2563eb"><ColorSwatch /></ColorSwatchPickerItem>
</ColorSwatchPicker>
```

- A `ColorSwatchPicker` is a listbox, and each `ColorSwatchPickerItem` is an option with a `color`.
- A `ColorSwatch` inside an item shows the color of the item, when it has no `color` of its own.
- `value` is a color of CSS. It starts its own state, or binds with `$bind`. See [State](./state.md). `onChange` gets the color of the item that the user picks.
- The value keeps the format of the item: an item with `#f00` gives `#f00`.
- An item is selected when its color equals the value as a color, so `rgb(255, 0, 0)` selects an item of `#f00`.
- Without a label, the list is named `Color swatch picker`. Give it an `aria-label`, or an `aria-labelledby`.

## Anatomy

```brm anatomy ColorSwatchPickerAnatomy
`ColorSwatchPicker`: The listbox of colors. It shows `data-layout`.
`ColorSwatchPickerItem`: One color. The selected item shows `data-selected`.
`ColorSwatch`: Shows the color of the item. Optional.
```

```html
<ColorSwatchPicker>
  <ColorSwatchPickerItem>
    <ColorSwatch />
  </>
</>
```

The `ColorSwatch` is optional. A ColorSwatchPicker holds one item for each color.

## Props

### ColorSwatchPicker

```props ColorSwatchPicker

```

### ColorSwatchPickerItem

```props ColorSwatchPickerItem

```

## Data attributes

### ColorSwatchPicker

| Attribute             | When                   |
| --------------------- | ---------------------- |
| `data-layout="grid"`  | The layout is a grid.  |
| `data-layout="stack"` | The layout is a stack. |

### ColorSwatchPickerItem

| Attribute            | When                                |
| -------------------- | ----------------------------------- |
| `data-selected`      | The color of the item is the value. |
| `data-disabled`      | The item is disabled.               |
| `data-pressed`       | A pointer or a key holds it down.   |
| `data-hovered`       | A pointer is over it.               |
| `data-focused`       | It has focus.                       |
| `data-focus-visible` | Its focus shows as a ring.          |

## Keyboard

The selection follows focus. A disabled item is skipped.

| Key                         | Action                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the list, at the item that had focus last, or else the selected item, or the first.                        |
| `ArrowRight` or `ArrowLeft` | In a grid, moves focus along the row and selects that item. Right to left, they turn around. In a stack, they do nothing. |
| `ArrowDown`                 | In a grid, moves to the nearest item in the row below. In a stack, moves to the next item. Selects it.                    |
| `ArrowUp`                   | In a grid, moves to the nearest item in the row above. In a stack, moves to the previous item. Selects it.                |
| `Home`                      | Moves to the first item and selects it.                                                                                   |
| `End`                       | Moves to the last item and selects it.                                                                                    |
| `PageUp` or `PageDown`      | Moves up or down by the height of the list and selects that item.                                                         |
| `Enter` or `Space`          | Selects the item that has focus.                                                                                          |
| A letter                    | Moves to the item whose color name starts with it and selects it.                                                         |

## Controlled and uncontrolled

`value` holds a color of CSS. How you pass it picks who keeps it:

```brm demo ColorSwatchPickerStateDemo

```

- `value` alone, or nothing, makes the list keep its own color. Without one, no item is selected until the user picks. `value="#f59e0b"` is where it starts. Pick another and the list keeps the pick. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the list follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and pick a color in the last list. The list shows what you keep, so a request that you ignore leaves the old selection.
- `onChange` gets the color of the item that the user picks, in the format of the item, in every shape.
- A ColorSwatchPicker is not a form field: it sends nothing with a form, and a reset does not touch it. Set your signal yourself on a reset. The server renders the selected item.

See [State](./state.md) for the other parts.

## Styling

Style the items with the data attributes above, and the list with `data-layout`. A ColorSwatch inside an item has `--color`. See [Styling](./styling.md).

This stylesheet styles an item in rest, hover, press, keyboard focus, selected, selected and hovered, and disabled. The ring grows with the state, and the keyboard ring has two bands. Press the arrow keys in the list, since the selection follows focus.

```brm styled ColorSwatchPickerStyled

```

## Use cases

### The color of a label

A `layout="stack"` list moves with ArrowUp and ArrowDown only. The chip below takes its color from the signal.

```brm demo ColorSwatchPickerLabelDemo

```

### Presets and a custom color

Inside a [ColorPicker](./color-picker.md), the list and a ColorField share the color. Type a color that no preset has, and every item is unselected, since an item is selected when its color equals the value.

```brm demo ColorSwatchPickerCustomDemo

```

## Layout

- `layout` is `grid`, the default, or `stack`. It sets `data-layout`. The layout of the items is yours to style.

## Selection

- The selection follows focus, and it cannot be empty. A press, Space or Enter on the item that is selected changes nothing, and a disabled item is never selected.
- An item shows `data-selected`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-pressed` and `data-hovered`.
- `isDisabled` on an item skips it with the keys. A press, Space or Enter on it does not select it, even when a click gave it focus.
