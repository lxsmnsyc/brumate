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
- The color keeps the format it was given, and its saturation and its lightness or brightness. A color of the rgb space, such as hex, is read as hue, saturation and brightness.
- The wheel edits a color at full precision, and gives back the format of the caller. Hex cannot hold the hue of a gray, so the thumb of a gray keeps where the user put it. `value` and `onChange` change only when an edit makes another color. When `value` changes from outside, such as from a reset of the form, the color follows it.
- `isDisabled` keeps it still. `name` sends the hue with a form, also before the code of the page loads.
- A screen reader reads the input as `Hue`. Give `aria-label` or `aria-labelledby` to name it another way.
- It shows `data-disabled`. A reset of the form gives back the first color.

## Anatomy

```html
<ColorWheel>
  <ColorWheelTrack />
  <ColorThumb />
</>
```

## Props

### ColorWheel

```props ColorWheel

```

### ColorWheelTrack

```props ColorWheelTrack

```

## Data attributes

### ColorWheel and ColorWheelTrack

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-disabled` | The wheel is disabled. |

### ColorThumb

| Attribute            | When                       |
| -------------------- | -------------------------- |
| `data-dragging`      | A pointer drags it.        |
| `data-focused`       | Its input has focus.       |
| `data-focus-visible` | Its focus shows as a ring. |
| `data-disabled`      | The wheel is disabled.     |

## Keyboard

The keys act on the thumb. A key with Ctrl, Meta or Alt moves nothing.

| Key                        | Action                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                      | Moves focus to the thumb. A disabled wheel is skipped.                                                                        |
| `ArrowRight` or `ArrowUp`  | Raises the hue by 1. With Shift it goes by 15 and snaps to a multiple of 15, so 10 goes to 30. After 359 it starts over at 0. |
| `ArrowLeft` or `ArrowDown` | Lowers the hue by 1. With Shift it goes by 15 and snaps to a multiple of 15. Below 0 it goes to 359.                          |
| `PageUp`                   | Raises the hue by 15, to a multiple of 15.                                                                                    |
| `PageDown`                 | Lowers the hue by 15, to a multiple of 15. From 0 it goes to 345.                                                             |
| `Home`                     | Goes to a hue of 0.                                                                                                           |
| `End`                      | Goes to a hue of 360, which is 0.                                                                                             |

## Controlled and uncontrolled

`value` holds a color of CSS. A plain `value` starts the wheel's own state, and `value=$bind(signal)` writes your signal. `onChange` gets the color as text each time an edit makes another color, and `onChangeEnd` gets it once a drag or a key ends. Inside a [ColorPicker](./color-picker.md), a wheel without a `value` reads and writes the color of the picker. A reset of the form gives back the first color. See [State](./state.md).

## Styling

Style the thumb with the data attributes above. The ring is the CSS of the ColorWheelTrack, so a class of yours can change its `background` and its `clip-path`. The wheel and the track are squares of twice the outer radius, and the thumb has `--color`. See [Styling](./styling.md).

## Track

- The `ColorWheelTrack` draws the ring: a conic gradient of the hue, from 3 o'clock and clockwise, with the size of the wheel, masked to the ring between the radii.
- The gradient and the mask are CSS of the part and not an inline style, so a class of yours can change them: another `background`, or a `clip-path` of your own.
- A press on the ring moves the hue to that angle, and a drag follows the angle. A press inside the inner radius or outside the outer radius does nothing.

## Thumb

- The ColorThumb sits on the middle of the ring at the angle of the hue, with `--color` set to the hue at full saturation. See [ColorThumb](./color-slider.md#colorthumb) for its attributes.
- A press on the thumb takes it where it is, so it does not jump to the pointer.
