# Styles

A `<style>` block holds CSS for its component. Its selectors match only the elements of that component, so class names never clash between components.

```brm live
<p class="note">This note is styled by its component.</p>

<style>
  .note {
    padding: 0.5rem 0.75rem;
    border-left: 3px solid tomato;
    background: #fff4f0;
    color: #3a1d14;
  }
</style>
```

## Scoping

Every selector in a `<style>` block matches only elements that the component itself renders:

- Another component's `.note` is not affected, even with the same class name.
- Elements that a child component renders are not affected either. See [Styling child components](#styling-child-components).
- Tag selectors such as `p` are safe to use, because they match only this component's `<p>` elements.

`:global(…)` leaves part of a selector unscoped:

```css
/* Any <p> inside this component's .card, including ones that child components render. */
.card :global(p) {
  margin: 0;
}

/* This component's .card, when an ancestor such as <html> has the dark class. */
:global(.dark) .card {
  background: #222;
}

/* Every <body>: a global rule. */
:global(body) {
  margin: 0;
}
```

## Dynamic values

`${expression}` in CSS reads a value of the component. When the value changes in the browser, the style changes with it.

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let size = $signal(18);
  let hue = $signal(200);
</script>

<label>
  Size
  <input type="range" min="12" max="40" value=size onInput=((event) => (size = Number(event.currentTarget.value)))>
</label>
<label>
  Hue
  <input type="range" min="0" max="360" value=hue onInput=((event) => (hue = Number(event.currentTarget.value)))>
</label>
<p class="preview">Size {size}px, hue {hue}</p>

<style>
  label {
    display: block;
  }
  .preview {
    font-size: ${size}px;
    color: hsl(${hue} 70% 45%);
  }
</style>
```

- Text right next to the expression is part of the value, so units work: `${size}px` gives `18px`, and `#${hex}` gives `#fff`.
- A value of `null`, `undefined` or `false` leaves the property unset.
- A value that never changes in the browser ships no client code.

## Classes

A `class` attribute takes a string, an object or an array, and a `style` attribute takes a string or an object. See [`class` and `style`](./markup.md#class-and-style).

Prefer classes and `${}` values in the `<style>` block. A `style` attribute is useful for one-off values that do not belong in the stylesheet.

## Styling child components

A component's styles do not reach into its children. Pick one of these:

- Give the child a prop, such as `tone="warning"`, and let the child style itself.
- Wrap the child in an element of your own, and use `:global` below it: `.toolbar :global(button) { … }`.
- Pass a class that the child puts on its root element, and style it with `:global(.my-class)`.

The first keeps each component in charge of its own look, so it is the easiest to change later.

## SCSS and Less

`lang="scss"` or `lang="less"` compiles the block with Sass or Less first:

```brm
<style lang="scss">
  $gap: 4px;

  .card {
    padding: $gap * 2;

    p {
      color: ${color};
    }
  }
</style>
```

- Install `sass` or `less` in the project.
- `${expression}` works the same as in CSS.
- `@use` and `@import` load files next to the component. A change to an imported file updates the component in development.
- An error of the preprocessor is a compile error that points at the block.

## Global stylesheets

Styles that apply to the whole site, such as a reset or fonts, go in the root layout. Two simple ways:

```brm
<!-- src/routes/_layout.brm: inline the file, so it arrives with the first byte of the page -->
<script>
  import { $props } from 'brumate/signals';
  import { raw } from 'brumate/html';
  import site from '../site.css?inline';

  const { children } = $props();
</script>

<html lang="en">
  <head>
    {raw(`<style>${site}</style>`)}
  </head>
  <body>{children}</body>
</html>
```

```brm
<!-- Or serve the file from public/ and link it -->
<link rel="stylesheet" href="/site.css">
```

A `<style>` block in the root layout with `:global(…)` rules works too, for a few rules.

## On the page

Each component's styles are written into the page once, right before its first instance. A page carries only the CSS of the components it shows, so its CSS is the critical CSS, and no stylesheet request delays the first paint.

[Style compilation](./style-compilation.md) explains how scoping and dynamic values are compiled.
