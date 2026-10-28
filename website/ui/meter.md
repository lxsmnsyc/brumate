# Meter

A value that stays in a known range, such as the space used on a disk.

```brm demo MeterDemo

```

- `value`, `minValue` and `maxValue` set the range, 0 to 100 by default.
- `aria-valuetext` is the value as the locale writes it, a percentage by default. `formatOptions` changes it, with the options of `Intl.NumberFormat`, and `valueLabel` replaces it.
- A `Label` inside names it.
- It sets `--percentage` for CSS, and a `content` template gets the percentage and the text. See [Styling](./styling.md#bars).

## Anatomy

```brm anatomy MeterAnatomy
`Meter`: The element with `role="meter"`. It sets `--percentage`.
`Label`: Names the meter.
```

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

The part sets `--percentage` in its own `style` attribute, and a `style` that you pass replaces it. Size the part with a class or a wrapper, and keep `style` for nothing else. The value is not rounded: a third is `33.33333333333333%`. A bar does not mind.

Draw the bar with `--percentage`, from `0%` to `100%`, or with the `content` template. See [Styling](./styling.md#bars).

This stylesheet draws a track and a fill in a `content` template, and the fill changes color with the level: green, amber and red. A meter has no data attributes, so the template picks the level from the percentage that it gets. The text beside the bar carries the value too, so color is not the only sign.

```brm styled MeterStyled

```

## State

A meter has no state of its own. It draws the `value` that you pass, so the page keeps the number, such as in a signal. A form reset leaves it as it is, and the server renders the value it gets.

## Use cases

### Units and words

`formatOptions` writes the value in a unit or a currency, and `valueLabel` replaces the text. The meter sets the text as `aria-valuetext`, so a screen reader says it too. A `minValue` other than 0 moves the start of the range, so a value of 3 in 1 to 5 fills half.

```brm demo MeterUnitsDemo

```

### A value that changes

The page keeps the charge in a signal. The meter follows it, and the note under it reads the same number.

```brm demo MeterBatteryDemo

```
