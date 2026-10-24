# Status

Parts that show a value in a range: `Meter` and `ProgressBar`.

```brm demo MeterDemo

```

## Meter

A value that stays in a known range, such as the space used on a disk.

- `value`, `minValue` and `maxValue` set the range, 0 to 100 by default.
- `aria-valuetext` is the value as the locale writes it, a percentage by default. `formatOptions` changes it, with the options of `Intl.NumberFormat`, and `valueLabel` replaces it.
- A `Label` inside names it.
- It sets `--percentage` for CSS, and a `content` template gets the percentage and the text.

## ProgressBar

The progress of a task. It takes the props of a `Meter`.

- `isIndeterminate` is a task of no known length. It has no value, and shows `data-indeterminate`.
