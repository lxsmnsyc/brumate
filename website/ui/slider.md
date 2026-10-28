# Slider

A value, or a range of values, that thumbs move on a track.

```brm demo SliderDemo

```

```html
<Slider value=$bind(price) maxValue=(1000)>
  <Label>Price</Label>
  <SliderOutput />
  <SliderTrack>
    <SliderThumb index=(0) aria-label="Minimum" />
    <SliderThumb index=(1) aria-label="Maximum" />
  </SliderTrack>
</Slider>
```

- A `Slider` holds a `Label`, a `SliderOutput`, and a `SliderTrack` with a `SliderThumb` for each value.
- `value` is a number for one thumb, or a list of numbers for several. It starts its own state, or binds with `$bind`. See [State](./state.md).
- `onChange` gets each change. `onChangeEnd` gets the value once a drag or a key ends.
- The Slider is a group that its Label names.
- A reset of the form gives back the first values.

## Anatomy

```brm anatomy SliderAnatomy
`Slider`: Holds the values and the range. It is a `group`.
`Label`: Names the slider.
`SliderOutput`: Shows the values as text, in the format of the locale.
`SliderTrack`: The line the thumbs sit on. A press on it moves the nearest thumb.
`SliderThumb`: One value. It holds a range input out of sight.
```

```html
<Slider>
  <Label />
  <SliderOutput />
  <SliderTrack>
    <SliderThumb />
  </>
</>
```

A track holds one `SliderThumb` for each value. The `Label` and the `SliderOutput` are optional.

## Props

### Slider

```props Slider

```

### SliderOutput

```props SliderOutput

```

### SliderTrack

```props SliderTrack

```

### SliderThumb

```props SliderThumb

```

## Data attributes

### Slider and SliderTrack

| Attribute                       | When                        |
| ------------------------------- | --------------------------- |
| `data-orientation="horizontal"` | The track lies in a row.    |
| `data-orientation="vertical"`   | The track lies in a column. |
| `data-disabled`                 | The slider is disabled.     |

### SliderThumb

| Attribute            | When                                 |
| -------------------- | ------------------------------------ |
| `data-dragging`      | A pointer drags it.                  |
| `data-focused`       | Its input has focus.                 |
| `data-focus-visible` | Its focus shows as a ring.           |
| `data-disabled`      | The thumb or the slider is disabled. |

## Keyboard

Keys act on the thumb that has focus.

| Key                        | Action                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| `Tab`                      | Moves focus to the next thumb. A disabled thumb is skipped.                 |
| `ArrowRight` or `ArrowUp`  | Raises the value by `step`.                                                 |
| `ArrowLeft` or `ArrowDown` | Lowers the value by `step`. Right to left, the horizontal keys turn around. |
| `PageUp`                   | Raises the value by a tenth of the range.                                   |
| `PageDown`                 | Lowers the value by a tenth of the range.                                   |
| `Home`                     | Goes to the start of the range of the thumb.                                |
| `End`                      | Goes to the end of the range of the thumb.                                  |

## Controlled and uncontrolled

`value` holds a number for one thumb, or a list of numbers for several. How you pass it picks who keeps it:

```brm demo SliderStateDemo

```

- `value` alone, or nothing, makes the slider keep its own values. `value=(30)` is where they start, and a new value from you replaces them.
- `value=$bind(signal)` writes your signal. Change the signal and the thumbs follow. The first button writes 80 to the third slider.
- `value=$bind(signal, (next) => ...)` asks you first. The slider shows the value that you keep. Press Lock and drag the thumb of the last slider, or press its keys: the thumb and the output stay where they were, and so does the range input.
- `onChange` gets the value that the user asked for in every shape, also when your request refuses it. `onChangeEnd` gets the value that the slider shows once a drag or a key ends.
- A reset of the form gives back the values that the slider started with, as a write: with `$bind(signal, request)`, your request can refuse it, and the slider then shows the kept value.
- The server renders the values it starts with. See [State](./state.md).

## Styling

Style the thumb with the data attributes above. The thumb is placed with `left`, `right` right to left, or `bottom` when vertical, so style its size and its `top`. The track is `position: relative`, so give it a size. See [Styling](./styling.md).

The part draws no fill. This stylesheet puts a `div` in the track and sets its `left` and `width` from the signal, which is one value or two. It styles rest, hover, drag, keyboard focus, a range of two thumbs and disabled. A form sends each thumb with its `name`.

```brm styled SliderStyled

```

## Use cases

### A range that filters a list

Two thumbs bind a list of two numbers. `onChangeEnd` applies the range when the user lets go, so the list does not jump during a drag.

```brm demo SliderPriceDemo

```

### Vertical sliders

`orientation="vertical"` lays the track in a column, and the thumb is placed with `bottom`. The buttons write the three signals at once.

```brm demo SliderMixerDemo

```

## Values

- The values stay between `minValue` and `maxValue`, 0 and 100 by default, on a `step`, 1 by default.
- A thumb cannot pass the thumbs next to it.
- `formatOptions` and the locale of an [I18nProvider](./i18n-provider.md) format the values, for the SliderOutput and for screen readers.
- The SliderOutput shows the values, such as `40`, or `$200 – $800` for two, or a list in the locale for more.

## Thumbs

- `index` is the value that a SliderThumb moves, 0 by default.
- Each thumb holds an `<input type="range">` out of sight. A screen reader reads it, the keys move it, and `name` sends its value with a form, also before the code of the page loads.
- The arrow keys step it. PageUp and PageDown move a tenth of the range. Home and End go to the ends of its range.
- A drag moves it from where the pointer took it, so it does not jump to the pointer. Two pointers, such as two fingers, drag two thumbs.
- `isDisabled` on a thumb keeps it still.
- The input has the `dir` of the locale, so the arrow keys follow the layout right to left.
- A thumb with an `aria-label` is named by it and by the Label of the Slider.
- The thumb is placed with `left`, `right` right to left, or `bottom` when vertical. Style its size and its `top`.
- It shows `data-dragging`, `data-focused`, `data-focus-visible` and `data-disabled`.

## Track

- A press on the SliderTrack moves the nearest thumb there, and a drag moves it on. The thumb shows `data-dragging` meanwhile.
- A press with Alt, Ctrl or Meta, a press while a thumb is dragged, and a press nearest a disabled thumb move nothing.
- The track is `position: relative`, so the thumbs sit on it. Give it a size.
