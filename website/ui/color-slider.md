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
- The color keeps the format it was given: hex stays hex, and `hsl()` stays `hsl()`. A hex color rounds to whole numbers of red, green and blue, so a hue read back from it can differ by a degree.
- `orientation` is `horizontal` or `vertical`. `isDisabled` keeps it still. `name` sends the value of the channel with a form, also before the code of the page loads.
- The ColorSlider is a group that its Label names. Without a Label, the name of the channel names it, such as `Hue`. It shows `data-orientation` and `data-disabled`.
- A reset of the form gives back the first color.

## Channel

- The range, the step and the page of PageUp and PageDown are those of the channel: hue goes to 360 in steps of 1 and pages of 15, and alpha goes to 1 in steps of 0.01 and pages of 0.1.
- The SliderOutput shows the channel in the format of the locale, such as `210°`, `50%` or `128`. Alpha shows as a percent.
- A screen reader hears the value and a name of the color it makes, such as `210°, blue`.

## Track

- The element of the ColorSlider has the custom property `--track-background`, the gradient of the channel with the other channels as they are. Give it to the track: `background: var(--track-background)`. The gradient follows the orientation and the direction of the locale.
- The track of alpha is the gradient over a checkerboard.
- A press on the track moves the thumb there, and a drag moves it on.
- The track is `position: relative`. Give it a size.

## ColorThumb

A ColorThumb has no page of its own, since it works only inside a ColorSlider, a ColorArea or a ColorWheel, which give it its state.

- It has `--color`, the color it shows, and a background of that color over a checkerboard. On a ColorSlider, a hue shows at full saturation, and a channel shows without its alpha.
- It is placed in the middle of its position on the parent with `position: absolute`. Give it a size, and a border if you like.
- It holds a hidden `<input type="range">` for each axis it moves, one for a slider and two for an area. A screen reader reads them, and the keys move them.
- A drag moves it from where the pointer took it, so it does not jump to the pointer.
- It shows `data-dragging`, `data-focused`, `data-focus-visible` and `data-disabled`.

### Building on ColorThumb

A part that has a thumb of color provides a `ColorThumbState` in `ColorThumbContext`, from `@brumate/ui/color-thumb.ts`:

- `color` is the color to show, as a color of CSS.
- `left` and `top` are the position of the center of the thumb, in percents of its parent. The part computes them, and flips them for a track that grows upward or right to left.
- `inputs` lists the hidden inputs as data: `id`, `name`, `min`, `max`, `step`, `value`, `valueText`, `label`, `labelledBy` and `orientation`.
- `isDragging`, `isFocused`, `isFocusVisible` and `isDisabled` are the states.
- `onInputChange(index, value)` and `onInputPage(index, direction)` get what the user does to an input. `onPress(event)` gets the press on the thumb, to start a drag. `onFocusChange(focused, focusVisible)` and `onChangeEnd()` follow the focus and the end of a change.
- The functions are declared in the part and not inside the lists, since the state of the page can hold a function only where the compiler can name it.
