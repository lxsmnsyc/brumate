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
- The area is a group. Give it an `aria-label` or an `aria-labelledby`, such as `Saturation and brightness`. With an `aria-label`, the group and both inputs say it with `Color picker`, such as `Saturation and brightness, Color picker`, and the group's own ID comes first in `aria-labelledby`. Without one, the inputs are named `Color picker`. An `aria-labelledby` reaches the group and both inputs, each input with its own ID first.

## Anatomy

```brm anatomy ColorAreaAnatomy
`ColorArea`: The group with the two-channel gradient as `--area-background`. Give it an `aria-label`.
`ColorThumb`: The handle. It holds two range inputs, one for each axis.
```

```html
<ColorArea>
  <ColorThumb />
</>
```

## Props

### ColorArea

```props ColorArea

```

## Data attributes

### ColorArea

| Attribute       | When                  |
| --------------- | --------------------- |
| `data-disabled` | The area is disabled. |

### ColorThumb

| Attribute            | When                       |
| -------------------- | -------------------------- |
| `data-dragging`      | A pointer drags it.        |
| `data-focused`       | An input of it has focus.  |
| `data-focus-visible` | Its focus shows as a ring. |
| `data-disabled`      | The area is disabled.      |

## Keyboard

The arrows act on either input of the thumb, and each moves its own axis. The other keys act on the axis of the input that has focus. Ctrl, Alt or Meta with an arrow moves the thumb one step, since the range input handles the key. Only a pointer press ignores the modifiers.

| Key          | Action                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| `Tab`        | Moves focus to the thumb. One input is a tab stop at a time.             |
| `ArrowRight` | Raises x by a step, or by a page with Shift. Right to left, it lowers x. |
| `ArrowLeft`  | Lowers x by a step, or by a page with Shift. Right to left, it raises x. |
| `ArrowUp`    | Raises y by a step, or by a page with Shift.                             |
| `ArrowDown`  | Lowers y by a step, or by a page with Shift.                             |
| `PageUp`     | Raises the axis of the input by a page.                                  |
| `PageDown`   | Lowers the axis of the input by a page.                                  |
| `End`        | Sets the axis of the input to its maximum.                               |
| `Home`       | Sets the axis of the input to its minimum.                               |

## Controlled and uncontrolled

`value` holds a color of CSS, `#ffffff` without one. How you pass it picks who keeps it. Each area below edits saturation and brightness, and Reset the form gives each one back the color it started with:

```brm demo ColorAreaStateDemo

```

- `value` alone, or nothing, makes the area keep its own color. `value="hsb(30, 80%, 90%)"` is where that color starts. Drag and the area keeps the new color. A new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the area follows.
- `value=$bind(signal, (next) => ...)` asks you first. Press Lock above and drag the last area.
- `onChange` gets the color as text in every shape, each time an edit makes another color. `onChangeEnd` gets it once a drag or a key ends.
- A reset of the form gives back the first color, as a write: with `$bind(signal, request)`, your request can refuse it. The server renders the color it starts with.
- With a request that refuses, the ColorArea shows the color you keep, and so do its inputs. Press Lock above and use the last one to see it.

See [State](./state.md) for the other parts.

## Styling

Style the area with `background: var(--area-background)` and `background-blend-mode: var(--area-background-blend-mode)`, and the thumb with the data attributes above. The area is `position: relative`, so give it a size. The thumb has `--color`. See [Styling](./styling.md).

This stylesheet styles the area with its gradient, the thumb in rest, dragging, keyboard focus and disabled, and a swatch that follows the value. A thumb has no hover state. Drag the thumb, or tab to it and press the arrows.

```brm styled ColorAreaStyled

```

## Use cases

### Hue beside the area

An area edits two channels, so the third needs a slider. Both use `colorSpace="hsb"` and one `$bind` signal. A drag in the area keeps the hue, and a move of the slider keeps the saturation and the brightness.

```brm demo ColorAreaHueDemo

```

### An area in a form

`xName` and `yName` send the two values with the form, also before the code of the page loads. Reset gives back the color the area started with.

```brm demo ColorAreaFormDemo

```

## Keys and screen readers

- There is one tab stop. When focus was last on the y input, the x input is out of the tab order (`tabindex="-1"`) and hidden from screen readers (`aria-hidden="true"`). The y input is out of both until it has the focus or a key changed the value.
- The focus goes to the input of the axis that a key moved.
- A screen reader hears the value of the input, the other axis and the third channel, and a name of the color without its alpha, such as `Saturation 50%, Brightness 80%, Hue 210°, blue`. After a change from a key it hears only the input and the color, such as `Saturation 51%, blue`, until the focus leaves.
- Ctrl, Alt or Meta with an arrow moves the thumb one step, since the range input handles the key. Only a pointer press ignores the modifiers.

## Pointer

- A press on the area moves the thumb there, and a drag follows. A press with Alt, Ctrl or Meta does nothing.
- A press on the thumb keeps the distance from the pointer to its center, so the thumb does not jump to the pointer.

## Style

- The element of the ColorArea has the custom property `--area-background`, the gradient of the two channels with the third one as it is. Give it to the area: `background: var(--area-background)`. The gradient follows the direction of the locale.
- For `rgb` the channels add up, so the layers need `background-blend-mode: var(--area-background-blend-mode)`, which is `screen` for `rgb` and `normal` otherwise.
- The area is `position: relative`. Give it a size.
- The thumb has `--color`, the color without its alpha. See [ColorThumb](./color-slider.md#colorthumb).
