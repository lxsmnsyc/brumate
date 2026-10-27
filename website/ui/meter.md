# Meter

A value that stays in a known range, such as the space used on a disk.

```brm demo MeterDemo

```

- `value`, `minValue` and `maxValue` set the range, 0 to 100 by default.
- `aria-valuetext` is the value as the locale writes it, a percentage by default. `formatOptions` changes it, with the options of `Intl.NumberFormat`, and `valueLabel` replaces it.
- A `Label` inside names it.
- It sets `--percentage` for CSS, and a `content` template gets the percentage and the text. See [Styling](./styling.md#bars).

## Anatomy

```html
<Meter>
  <Label />
</>
```

The `Label` is optional. Without one, name the meter with `aria-label`.

## Props

```props Meter

```

## Data attributes

A `Meter` sets no data attributes. It sets `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`, and the CSS custom property `--percentage`.

## Styling

Draw the bar with `--percentage`, from `0%` to `100%`, or with the `content` template. See [Styling](./styling.md#bars).
