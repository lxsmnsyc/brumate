# ColorPicker

Holds one color for the color parts inside it.

```brm demo ColorPickerDemo

```

```html
<ColorPicker value=$bind(color)>
  <ColorArea><ColorThumb /></ColorArea>
  <ColorField><Input /></ColorField>
  <ColorSwatch />
</ColorPicker>
```

- A `ColorPicker` has no element of its own. It renders its children, and gives its color to the parts inside it.
- `value` is a color of CSS. It starts its own state, or binds with `$bind`. See [State](./state.md). `onChange` gets each change from any part.
- `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorField` and `ColorSwatchPicker` inside it show the color of the picker, and write it. A change in one shows in the others.
- `ColorSwatch` inside it shows the color of the picker. Its own `color` wins, and so does the color of a `ColorSwatchPickerItem`.
- A part with a `value` of its own keeps it: `value=(x)` or `value=$bind(signal)` makes the part independent of the picker.
- A part outside a picker works as before.

## Format

- The picker keeps its color at full precision, which hex cannot hold, such as the hue of a gray. The parts edit that color and share it. It gives back the format of the caller, and writes `value`, `$bind` and `onChange` only when an edit makes another color. When `value` changes from outside, the color follows it.
- The picker keeps the format of its value. A part writes in that format, so `hsb(210, 50%, 80%)` stays in `hsb` when the field types a hex.
- A pick in a `ColorSwatchPicker` gives the color as the item wrote it, and the picker has that format from then on.
- A `ColorField` that is cleared keeps the color of the picker, as the picker has no empty value.
