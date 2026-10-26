# ColorArea

An area for two channels of a color.

```brm demo ColorAreaDemo

```

```html
<ColorArea value=$bind(color)>
  <ColorThumb />
</ColorArea>
```

- A `ColorArea` holds a [ColorThumb](./color-slider.md#colorthumb), which moves on both axes.
- `xChannel` and `yChannel` are the channels of the axes: `hue`, `saturation`, `lightness`, `brightness`, `red`, `green` or `blue`. Y grows upward. Without them, x is saturation and y is brightness, in `hsb`.
- `colorSpace` is the space that it reads the channels in, `rgb`, `hsl` or `hsb`. A color of another space moves to it. Without it, the space is the first of `hsb`, `hsl` and `rgb` that has both channels. Give one channel, and the other is the next channel of the space.
- `value` is a color of CSS, such as `#e2445a`. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change. `onChangeEnd` gets the color once a drag or a key ends.
- The color keeps the format it was given: hex stays hex, and `hsl()` stays `hsl()`. A hex color rounds to whole numbers of red, green and blue, so a step of a channel can leave the color as it was.
- `isDisabled` keeps it still and shows `data-disabled`.
- `xName` and `yName` send the two values with a form, also before the code of the page loads. A reset of the form gives back the first color.
- The area is a group named `Color area`. Give it an `aria-label` of your own, such as `Saturation and brightness`.

## Keys

The thumb has a hidden `<input type="range">` for each axis. The keys work on either of them.

- Left and Right move x by a step. Up and Down move y.
- PageUp and PageDown move y by a page. With Shift, they move x.
- Home and End move x down and up by a page.
- Right to left, x is mirrored: Left moves toward the larger values, and Home goes to the right.
- A screen reader hears both values and a name of the color, such as `Saturation 50%, Brightness 80%, blue`.

## Pointer

- A press on the area moves the thumb there, and a drag follows.
- A press on the thumb keeps the distance from the pointer to its center, so the thumb does not jump to the pointer.

## Style

- The element of the ColorArea has the custom property `--area-background`, the gradient of the two channels with the third one as it is. Give it to the area: `background: var(--area-background)`. The gradient follows the direction of the locale.
- For `rgb` the channels add up, so the layers need `background-blend-mode: var(--area-background-blend-mode)`, which is `screen` for `rgb` and `normal` otherwise.
- The area is `position: relative`. Give it a size.
- The thumb has `--color`, the color without its alpha. See [ColorThumb](./color-slider.md#colorthumb).
