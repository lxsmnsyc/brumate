# ColorSlider

A slider for one channel of a color.

```brm demo ColorSliderDemo

```

```html
<ColorSlider channel="hue" value=$bind(color)>
  <Label>Hue</Label>
  <SliderOutput />
  <SliderTrack>
    <ColorThumb />
  </SliderTrack>
</ColorSlider>
```

- A `ColorSlider` holds a `Label`, a `SliderOutput`, and a `SliderTrack` with a `ColorThumb`. The Label, the SliderOutput and the SliderTrack are those of [Slider](./slider.md).
- `channel` is the channel that it adjusts: `hue`, `saturation`, `lightness`, `brightness`, `red`, `green`, `blue` or `alpha`.
- `colorSpace` is the space that it reads the channel in, `rgb`, `hsl` or `hsb`. A color of another space moves to it. Without it, the color keeps its own space, and moves to one that has the channel when its own does not.
- `value` is a color of CSS, such as `#e2445a`. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change. `onChangeEnd` gets the color once a drag or a key ends.
- The color keeps the format it was given: hex stays hex, and `hsl()` stays `hsl()`.
- The slider edits a color at full precision, and gives back the format of the caller. Hex cannot hold the hue of a gray, so the thumb of a hue keeps where the user put it. `value` and `onChange` change only when an edit makes another color, and then the string of the caller stays as it was. When `value` changes from outside, such as from a reset of the form, the color follows it.
- `orientation` is `horizontal` or `vertical`. `isDisabled` keeps it still. `name` sends the value of the channel with a form, also before the code of the page loads.
- The ColorSlider is a group that its Label names. Without a Label, the name of the channel names it, such as `Hue`. It shows `data-orientation` and `data-disabled`.
- A reset of the form gives back the first color.

## Anatomy

```html
<ColorSlider>
  <Label />
  <SliderOutput />
  <SliderTrack>
    <ColorThumb />
  </>
</>
```

The `Label` and the `SliderOutput` are optional.

## Props

### ColorSlider

```props ColorSlider

```

### ColorThumb

```props ColorThumb

```

## Data attributes

### ColorSlider and SliderTrack

| Attribute                       | When                        |
| ------------------------------- | --------------------------- |
| `data-orientation="horizontal"` | The track lies in a row.    |
| `data-orientation="vertical"`   | The track lies in a column. |
| `data-disabled`                 | The slider is disabled.     |

### ColorThumb

| Attribute            | When                       |
| -------------------- | -------------------------- |
| `data-dragging`      | A pointer drags it.        |
| `data-focused`       | Its input has focus.       |
| `data-focus-visible` | Its focus shows as a ring. |
| `data-disabled`      | The slider is disabled.    |

## Keyboard

The keys act on the thumb. A key with Ctrl, Meta or Alt moves nothing.

| Key          | Action                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| `Tab`        | Moves focus to the thumb. A disabled slider is skipped.                             |
| `ArrowRight` | Raises the channel by a step, or by a page with Shift. Right to left, it lowers it. |
| `ArrowLeft`  | Lowers the channel by a step, or by a page with Shift. Right to left, it raises it. |
| `ArrowUp`    | Raises the channel by a step, or by a page with Shift.                              |
| `ArrowDown`  | Lowers the channel by a step, or by a page with Shift.                              |
| `PageUp`     | Raises the channel by a page.                                                       |
| `PageDown`   | Lowers the channel by a page.                                                       |
| `Home`       | Goes to the least value of the channel.                                             |
| `End`        | Goes to the greatest value of the channel.                                          |

## Controlled and uncontrolled

`value` holds a color of CSS. A plain `value` starts the slider's own state, and `value=$bind(signal)` writes your signal. `onChange` gets the color as text each time an edit makes another color, and `onChangeEnd` gets it once a drag or a key ends. Inside a [ColorPicker](./color-picker.md), a slider without a `value` reads and writes the color of the picker. A reset of the form gives back the first color. See [State](./state.md).

## Styling

Style the track with `background: var(--track-background)`, and the thumb with the data attributes above. The thumb has `--color`. The track is `position: relative` and the thumb is `position: absolute`, so give both a size. See [Styling](./styling.md).

## Channel

- The range, the step and the page of PageUp and PageDown are those of the channel: hue goes to 360 in steps of 1 and pages of 15, and alpha goes to 1 in steps of 0.01 and pages of 0.1.
- The SliderOutput shows the channel in the format of the locale, such as `210°`, `50%` or `128`. Alpha shows as a percent.
- A screen reader hears the value and a name of the color it makes, such as `210°, blue`. The color is named without its alpha.

## Track

- The element of the ColorSlider has the custom property `--track-background`, the gradient of the channel with the other channels as they are. Give it to the track: `background: var(--track-background)`. The gradient follows the orientation and the direction of the locale.
- The track of alpha is the gradient over a checkerboard.
- A press on the track moves the thumb there, and a drag moves it on.
- The track is `position: relative`. Give it a size.

## ColorThumb

A ColorThumb has no page of its own, since it works only inside a ColorSlider, a ColorArea or a ColorWheel, which give it its state.

- It has `--color`, the color it shows, and a background of that color over a checkerboard. On a ColorSlider, a hue shows at full saturation, and a channel shows without its alpha.
- It is placed in the middle of its position on the parent with `position: absolute`. Give it a size, and a border if you like.
- It holds a hidden `<input type="range">` for each axis it moves, one for a slider and two for an area. A screen reader reads them, and the keys move them: the part takes all the keys of the input.
- A press with Alt, Ctrl or Meta does not start a drag.
- A drag moves it from where the pointer took it, so it does not jump to the pointer.
- It shows `data-dragging`, `data-focused`, `data-focus-visible` and `data-disabled`.

### Building on ColorThumb

A part that has a thumb of color provides a `ColorThumbState` in `ColorThumbContext`, from `@brumate/ui/color-thumb.ts`:

- `color` is the color to show, as a color of CSS.
- `left` and `top` are the position of the center of the thumb, in percents of its parent. The part computes them, and flips them for a track that grows upward or right to left.
- `inputs` lists the hidden inputs as data: `id`, `name`, `min`, `max`, `step`, `value`, `valueText`, `label`, `labelledBy`, `orientation`, `roleDescription`, `tabIndex` and `hidden`.
- `isDragging`, `isFocused`, `isFocusVisible` and `isDisabled` are the states.
- `onInputChange(index, value)` gets a value that a screen reader sets on an input. `onInputKey(index, key, shiftKey)` gets the arrows, PageUp, PageDown, Home and End, and the range input does not move by itself. A [ColorArea](./color-area.md) needs it, since Up on the input of x moves y. `onPress(event)` gets the press on the thumb, to start a drag. `onFocusChange(focused, focusVisible, index)` and `onChangeEnd()` follow the focus and the end of a change.
- The functions are declared in the part and not inside the lists, since the state of the page can hold a function only where the compiler can name it.
