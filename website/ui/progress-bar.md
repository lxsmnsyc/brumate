# ProgressBar

The progress of a task.

```brm demo ProgressBarDemo

```

- It takes the props of a [Meter](./meter.md): `value`, `minValue`, `maxValue`, `formatOptions` and `valueLabel`.
- `isIndeterminate` is a task of no known length. It has no value, and shows `data-indeterminate`.
- It sets `--percentage` for CSS. See [Styling](./styling.md#bars).

## Anatomy

```brm anatomy ProgressBarAnatomy
`ProgressBar`: The element with `role="progressbar"`. It sets `--percentage`.
`Label`: Names the bar.
```

```html
<ProgressBar>
  <Label />
</>
```

The `Label` is optional. Without one, name the bar with `aria-label`.

## Props

```props ProgressBar

```

## Data attributes

| Attribute            | When                      |
| -------------------- | ------------------------- |
| `data-indeterminate` | It has `isIndeterminate`. |

## Styling

The part sets `--percentage` in its own `style` attribute, and a `style` that you pass replaces it. Size the part with a class or a wrapper, and keep `style` for nothing else.

Draw the bar with `--percentage`, from `0%` to `100%`, or with the `content` template. An indeterminate bar sets no `--percentage`, so style it by `[data-indeterminate]`. See [Styling](./styling.md#bars).

This stylesheet draws a track and a fill in a `content` template. The fill reads `--percentage`. An indeterminate bar slides a stripe across the track, and with reduced motion the stripe stops and fills the track at half strength. The value is also written as text, so the bar is not the only sign.

```brm styled ProgressBarStyled

```

## State

A bar has no state of its own. It draws the `value` that you pass, so the page keeps the number, such as in a signal. A form reset leaves it as it is, and the server renders the value it gets.

## Use cases

### An upload that can be cancelled

The page writes the value from a timer. Each start or cancel makes a new run, so a timer of an old run sees that it is stale and stops. Upload is disabled while it runs, so quick presses start nothing twice.

```brm demo ProgressBarUploadDemo

```

### Steps and a wait of unknown length

`minValue`, `maxValue` and `valueLabel` turn a step into a bar: step 2 of 4 is a third of the way, and the text says "Step 2 of 4". Press Save for a task with no known length. `isIndeterminate` follows the signal, and the bar has a value again when it ends.

```brm demo ProgressBarStepsDemo

```
