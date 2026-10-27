# ColorArea

An area for two channels of a color.

```brm demo ColorAreaDemo

```

```html
<ColorArea xChannel="saturation" yChannel="brightness" value=$bind(color)>
  <ColorThumb />
</ColorArea>
```

- A `ColorArea` holds a [ColorThumb](./color-slider.md#colorthumb), which moves on both axes.
- `xChannel` and `yChannel` are the channels of the axes: `hue`, `saturation`, `lightness`, `brightness`, `red`, `green` or `blue`. Y grows upward. Without them, they are the first two channels of the space: hue and saturation for `hsb` and `hsl`, and red and green for `rgb`. Give one, and the other is the first channel of the space that is left.
- `colorSpace` is the space that it reads the channels in, `rgb`, `hsl` or `hsb`. A color of another space moves to it. Without it, the space is that of `value`, such as `rgb` for a hex color, when it has the channels, or else the first of `hsb`, `hsl` and `rgb` that has them.
- `value` is a color of CSS, such as `#e2445a`. It starts its own state, or binds with `$bind`. See [State](./state.md). Without one, it is `#ffffff`.
- `onChange` gets each change. `onChangeEnd` gets the color once a drag or a key ends.
- The color keeps the format it was given: hex stays hex, and `hsl()` stays `hsl()`.
- The area edits a color at full precision, and gives back the format of the caller. Hex cannot hold the hue of a gray, nor hsl the saturation of black, so a drag to saturation 0 and back keeps the hue. `value` and `onChange` change only when an edit makes another color. When `value` changes from outside, such as from a reset of the form, the color follows it.
- `isDisabled` keeps it still and shows `data-disabled`.
- `xName` and `yName` send the two values with a form, also before the code of the page loads. A reset of the form gives back the first color.
- The area is a group. Give it an `aria-label` or an `aria-labelledby`, such as `Saturation and brightness`. The group and both inputs say that label and `Color picker`, such as `Saturation and brightness, Color picker`, and the inputs are `Color picker` without a label. An `aria-labelledby` reaches the group and both inputs, each with its own ID first.

## Keys

The thumb has a hidden `<input type="range">` for each axis. The keys work on either of them.

- Left and Right move x by a step. Up and Down move y.
- With Shift, the arrow keys move by a page.
- PageUp and PageDown move y by a page.
- Home and End move x down and up by a page.
- Right to left, x is mirrored: Left moves toward the larger values, and Home goes to the right.
- The focus goes to the input of the axis that a key moved.
- There is one tab stop: the input of y is out of the tab order and hidden from screen readers (`tabindex="-1"` and `aria-hidden="true"`), until it has the focus or a key changed the value. The input that had the focus last is the tab stop.
- A screen reader hears the value of the input, the other axis and the third channel, and a name of the color without its alpha, such as `Saturation 50%, Brightness 80%, Hue 210°, blue`. After a change from a key it hears only the input and the color, such as `Saturation 51%, blue`, until the focus leaves.
- A key with Ctrl, Meta or Alt moves nothing. Until the loader of the page matches the modifiers, such a key is still prevented, so Cmd+Left does not go back.

## Pointer

- A press on the area moves the thumb there, and a drag follows. A press with Alt, Ctrl or Meta does nothing.
- A press on the thumb keeps the distance from the pointer to its center, so the thumb does not jump to the pointer.

## Style

- The element of the ColorArea has the custom property `--area-background`, the gradient of the two channels with the third one as it is. Give it to the area: `background: var(--area-background)`. The gradient follows the direction of the locale.
- For `rgb` the channels add up, so the layers need `background-blend-mode: var(--area-background-blend-mode)`, which is `screen` for `rgb` and `normal` otherwise.
- The area is `position: relative`. Give it a size.
- The thumb has `--color`, the color without its alpha. See [ColorThumb](./color-slider.md#colorthumb).
