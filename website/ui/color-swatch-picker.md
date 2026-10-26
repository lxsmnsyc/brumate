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

## Layout

- `layout` is `grid`, the default, or `stack`. It sets `data-layout`. The layout of the items is yours to style.
- In a grid, the arrow keys move in two dimensions: Left and Right along a row, Up and Down to the item above or below that is nearest. The boxes of the items tell where they are.
- In a stack, Up and Down move, and Left and Right do nothing.
- Home and End go to the first and the last item. PageUp and PageDown move by the height of the list.
- Letters move to the item whose color name starts with them, such as `g` for `green`. The selection follows.

## Selection

- The selection follows focus, and it cannot be empty. A press, Space or Enter on the item that is selected changes nothing, and a disabled item is never selected.
- Tab stops once in the list: at the item that had focus last, or else at the selected item, or the first item.
- An item shows `data-selected`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-pressed` and `data-hovered`.
- `isDisabled` on an item skips it with the keys. A press, Space or Enter on it does not select it, even when a click gave it focus.
