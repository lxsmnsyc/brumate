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
- The background shows the color over a checkerboard, so its alpha shows.
- The element has `--color`, the color, for CSS. Give it a size.

## Colors in the state

The color parts keep a color as a string of CSS, such as `#e2445a`, because the state of the page cannot hold an object of a class. `@brumate/ui/color.ts` parses and formats them:

- `parseColor(text)` gives a color, and throws on text that is not one. `tryParseColor(text)` gives undefined instead.
- `formatColor(color, format)` writes it as `hex`, `hexa`, `rgb`, `rgba`, `hsl`, `hsla`, `hsb`, `hsba`, or `css`, the format of its own space.
- `channelValue(color, channel)` and `withChannelValue(color, channel, value)` read and write a channel, such as `hue` or `alpha`.
