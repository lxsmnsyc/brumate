# ColorWheel

A circular track for the hue of a color.

```brm demo ColorWheelDemo

```

```html
<ColorWheel value=$bind(color) outerRadius=(90) innerRadius=(66)>
  <ColorWheelTrack />
  <ColorThumb />
</ColorWheel>
```

- A `ColorWheel` holds a `ColorWheelTrack` and a `ColorThumb`. The thumb is the one that [ColorSlider](./color-slider.md) uses.
- `outerRadius` and `innerRadius` are the radii of the ring in pixels. The ColorWheel is a square of twice the outer radius.
- `value` is a color of CSS, such as `hsl(210, 80%, 50%)`. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change. `onChangeEnd` gets the color once a drag or a key ends.
- The color keeps the format it was given, and its saturation and its lightness or brightness. A color of the rgb space, such as hex, is read as hue, saturation and lightness. A hex color rounds to whole numbers of red, green and blue, so a hue read back from it can differ by a degree.
- `isDisabled` keeps it still. `name` sends the hue with a form, also before the code of the page loads.
- A screen reader reads the input as `Hue`. Give `aria-label` or `aria-labelledby` to name it another way.
- It shows `data-disabled`. A reset of the form gives back the first color.

## Track

- The `ColorWheelTrack` draws the ring: a conic gradient of the hue, from 3 o'clock and clockwise, with the size of the wheel, masked to the ring between the radii.
- The gradient and the mask are CSS of the part and not an inline style, so a class of yours can change them: another `background`, or a `clip-path` of your own.
- A press on the ring moves the hue to that angle, and a drag follows the angle. A press inside the inner radius or outside the outer radius does nothing.

## Thumb

- The ColorThumb sits on the middle of the ring at the angle of the hue, with `--color` set to the hue at full saturation. See [ColorThumb](./color-slider.md#colorthumb) for its attributes.
- A press on the thumb takes it where it is, so it does not jump to the pointer.

## Keys

- The thumb has one hidden `<input type="range">` from 0 to 360. The arrow keys step the hue by 1, Right and Up up and Left and Down down. Home goes to 0, and End goes to 360, which is 0.
- The hue is a circle. A step up from 359 gives 0, and a step down from 0 gives 359.
- PageUp and PageDown move by 15, to a multiple of 15. A page down from 0 gives 345.
- The shift key does not make the arrow keys move by a page, as it does in React Aria. Use PageUp and PageDown.
