# ColorSwatch

A sample of a color, named for screen readers.

```brm demo ColorSwatchDemo

```

```html
<ColorSwatch color="#e2445a" />
<ColorSwatch color="hsl(210, 50%, 40%)" colorName="Ocean" />
```

- `color` is a color of CSS: hex, `rgb()`, `hsl()` or `hsb()`, with or without alpha.
- It is `role="img"`, with the role description `color swatch`.
- `colorName` names it for screen readers. Without it, a short name in English names it, such as `dark blue`, and says how transparent it is, such as `green, 50% transparent`.
- An `aria-label` adds to that name: `red, Brand`. It does not replace it.
- The background shows the color over a checkerboard, so its alpha shows.
- The element has `--color`, the color, for CSS. Give it a size.

## Props

```props ColorSwatch

```

## Styling

A ColorSwatch has no data attributes. The element has the custom property `--color`, the color it shows, and a background of that color over a checkerboard. Give it a size and a shape. See [Styling](./styling.md).

This stylesheet gives the swatch a size, a shape and an edge that shows on the page in both themes. The part draws the color, and the checkerboard under a color with alpha. A swatch has no state, so there is nothing else to style.

```brm styled ColorSwatchStyled

```

## Use cases

### A palette with names

`colorName` names a swatch for screen readers, and a color without it gets a name in English, such as `dark blue`. The table gives the name and the value as text too, since a swatch alone is not enough for someone who cannot see it.

```brm demo ColorSwatchPaletteDemo

```

### A preview of the opacity

A color with alpha shows over a checkerboard, so the opacity can be seen. The slider writes the alpha of the color that the swatch shows.

```brm demo ColorSwatchPreviewDemo

```

## Colors in the state

The color parts keep a color as a string of CSS, such as `#e2445a`, because the state of the page cannot hold an object of a class. `@brumate/ui/color.ts` parses and formats them:

- `parseColor(text)` gives a color, and throws on text that is not one. `tryParseColor(text)` gives undefined instead.
- `formatColor(color, format)` writes it as `hex`, `hexa`, `rgb`, `rgba`, `hsl`, `hsla`, `hsb`, `hsba`, or `css`, the format of its own space.
- `channelValue(color, channel)` and `withChannelValue(color, channel, value)` read and write a channel, such as `hue` or `alpha`.
