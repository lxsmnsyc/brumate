# ColorPicker

Holds one color for the color parts inside it.

```brm demo ColorPickerDemo

```

```html
<ColorPicker value=$bind(color)>
  <ColorArea xChannel="saturation" yChannel="brightness"><ColorThumb /></ColorArea>
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

## Anatomy

```html
<ColorPicker>
  <ColorArea />
  <ColorSlider />
  <ColorWheel />
  <ColorField />
  <ColorSwatchPicker />
  <ColorSwatch />
</>
```

Every part inside is optional.

## Props

```props ColorPicker

```

## Controlled and uncontrolled

`value` holds a color of CSS. How you pass it picks who keeps it. Each picker below holds a ColorField and a swatch:

```brm demo ColorPickerStateDemo

```

- `value` alone, or nothing, makes the picker keep its own color. `value="#f59e0b"` is where it starts. Type a color and the picker keeps it. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and every part inside follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and type in the last field.
- `onChange` gets the color as text in every shape, each time an edit from any part makes another color.
- A ColorPicker is not a form field and has no reset of its own. A ColorField, ColorArea, ColorSlider or ColorWheel inside it with no `value` writes the picker on a reset of its form, with the color the picker had when the form rendered. The server renders the color it starts with.
- With a request that refuses, a ColorPicker on main today can show the refused value in its parts: the field draws the new text before the picker asks, and a refusal leaves it drawn, while the swatch and your signal keep the old color. The node `ui-refused-write-sync` (#332) makes the parts show the kept value. Press Lock above and use the last one to see which you get.

See [State](./state.md) for the other parts.

## Styling

A ColorPicker has no element, so it has no data attributes and no classes. Style the parts inside it. See [Styling](./styling.md).

This stylesheet styles a picker of an area, a hue slider, a hex field, a swatch and presets. Every part follows the color of the picker. It names the states of each part: thumbs in rest, dragging and keyboard focus, the input in rest, hover and focus, and the presets in rest, hover, press, selected and keyboard focus.

```brm styled ColorPickerStyled

```

## Use cases

### A color in a form

The ColorField inside the picker has a `name`, so the form sends the hex. The presets change the color, and typing in the field changes the selected preset.

```brm demo ColorPickerFormDemo

```

### A part that keeps its own color

A part with a `value` of its own does not read or write the picker. The second slider below starts at red and moves alone, and `onChange` of the picker runs for the others only.

```brm demo ColorPickerIndependentDemo

```

## Format

- The picker keeps its color at full precision, which hex cannot hold, such as the hue of a gray. The parts edit that color and share it. It gives back the format of the caller, and writes `value`, `$bind` and `onChange` only when an edit makes another color. When `value` changes from outside, the color follows it.
- The picker keeps the format of its value. A part writes in that format, so `hsb(210, 50%, 80%)` stays in `hsb` when the field types a hex.
- A pick in a `ColorSwatchPicker` gives the color as the item wrote it, and the picker has that format from then on.
- A `ColorField` that is cleared keeps the color of the picker, as the picker has no empty value.
