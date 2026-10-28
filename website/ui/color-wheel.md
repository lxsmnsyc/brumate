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

```brm anatomy ColorWheelAnatomy
`ColorWheel`: The square that holds the ring. Give it `outerRadius` and `innerRadius`.
`ColorWheelTrack`: Draws the ring as a conic gradient of the hue.
`ColorThumb`: The handle. It sits on the ring at the angle of the hue.
```

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

The keys act on the thumb. Ctrl, Alt or Meta with an arrow moves the thumb one step, since the range input handles the key. Only a pointer press ignores the modifiers.

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

`value` holds a color of CSS. How you pass it picks who keeps it. Each wheel below edits the hue, and Reset the form gives each one back the color it started with:

```brm demo ColorWheelStateDemo

```

- `value` alone, or nothing, makes the wheel keep its own color. `value="hsl(30, 80%, 50%)"` is where that color starts. Drag and the wheel keeps the new color. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the wheel follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and drag the last wheel.
- `onChange` gets the color as text in every shape, each time an edit makes another color. `onChangeEnd` gets it once a drag or a key ends.
- A reset of the form gives back the first color, as a write: with `$bind(signal, request)`, your request can refuse it. The server renders the color it starts with.
- With a request that refuses, the ColorWheel shows the color you keep, and so do its inputs. Press Lock above and use the last one to see it.

See [State](./state.md) for the other parts.

## Styling

Style the thumb with the data attributes above. The ring is the CSS of the ColorWheelTrack, so a class of yours can change its `background` and its `clip-path`. The wheel and the track are squares of twice the outer radius, and the thumb has `--color`. See [Styling](./styling.md).

This stylesheet styles the thumb in rest, dragging, keyboard focus and disabled, and dims a disabled wheel. The ring is the track of the part. A thumb has no hover state. Drag the thumb, or tab to it and press the arrows.

```brm styled ColorWheelStyled

```

## Use cases

### Colors from one hue

A wheel edits only the hue. The base color, its complement and two near colors are computed from the hue with the helpers of `@brumate/ui/color.ts`. The signal holds the color as text.

```brm demo ColorWheelHarmonyDemo

```

### A wheel in a form

`name` sends the hue with the form, also before the code of the page loads. Reset gives back the color the wheel started with.

```brm demo ColorWheelFormDemo

```

## Track

- The `ColorWheelTrack` draws the ring: a conic gradient of the hue, from 3 o'clock and clockwise, with the size of the wheel, masked to the ring between the radii.
- The gradient and the mask are CSS of the part and not an inline style, so a class of yours can change them: another `background`, or a `clip-path` of your own.
- A press on the ring moves the hue to that angle, and a drag follows the angle. A press inside the inner radius or outside the outer radius does nothing.

## Thumb

- The ColorThumb sits on the middle of the ring at the angle of the hue, with `--color` set to the hue at full saturation. See [ColorThumb](./color-slider.md#colorthumb) for its attributes.
- A press on the thumb takes it where it is, so it does not jump to the pointer.
