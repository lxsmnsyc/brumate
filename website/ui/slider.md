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

`value` holds a number for one thumb, or a list of numbers for several. A plain `value` starts the slider's own state, and `value=$bind(signal)` writes your signal. `onChange` gets each change, and `onChangeEnd` gets the value once a drag or a key ends. A reset of the form gives back the first values. See [State](./state.md).

## Styling

Style the thumb with the data attributes above. The thumb is placed with `left`, `right` right to left, or `bottom` when vertical, so style its size and its `top`. The track is `position: relative`, so give it a size. See [Styling](./styling.md).

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
