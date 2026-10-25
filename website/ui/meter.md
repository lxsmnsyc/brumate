# Meter

A value that stays in a known range, such as the space used on a disk.

```brm demo MeterDemo

```

- `value`, `minValue` and `maxValue` set the range, 0 to 100 by default.
- `aria-valuetext` is the value as the locale writes it, a percentage by default. `formatOptions` changes it, with the options of `Intl.NumberFormat`, and `valueLabel` replaces it.
- A `Label` inside names it.
- It sets `--percentage` for CSS, and a `content` template gets the percentage and the text. See [Styling](./styling.md#bars).
