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
- Scoping adds no specificity. The scope attribute is written as `:where([b-c-<hash>])`, so `.a .b` keeps the specificity (0,2,0) it was written with, and a global or parent rule of the same written specificity that comes later in the page overrides it.

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

### Global blocks

A `<style global>` block holds rules that are not scoped, so a stylesheet of many unscoped selectors needs no `:global(…)` around each one:

```brm
<style global>
  body {
    margin: 0;
  }

  .toolbar button {
    border-radius: 4px;
  }
</style>

<style>
  /* Still scoped. */
  .card {
    padding: 1rem;
  }
</style>
```

- A component can have both kinds of block. Only the plain `<style>` blocks get the scope attribute.
- A global block travels with its component, like any other style: the page carries it once, before the first instance, and a page that does not render the component does not carry it.
- It works with `lang="scss"` and `lang="less"`, as in `<style global lang="scss">`, and with `${expression}`.
- `:global(…)` inside it is allowed and means nothing more than its content.
- Like `<style>`, it is allowed at the top level of the file and of a block body. In a block it is unscoped too, so a global rule applies whether or not the block shows, and it matches elements outside the block.

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

## A style in a block

A block body can hold a `<style>` too, as it can hold a `<script>`. One rule covers every `<style>`: it applies to its block and to the blocks inside it. The file is the outermost block, so the `<style>` at its top level is the style of the file and of every block in it. In a block, its `${}` can read the item and the signals of the block script, and `<style global>` and `:global(…)` work as at the top level.

```brm live
<script>
  import { $signal } from 'brumate/signals';

  const swatches = [
    { id: 1, color: 'tomato' },
    { id: 2, color: 'gold' },
    { id: 3, color: 'royalblue' },
  ];
</script>

#for (swatch of swatches by swatch.id) {
  <script>
    let size = $signal(24);
  </script>
  <button class="swatch" onClick=(() => (size += 8))>{size}px</button>
  <style>
    .swatch {
      background: ${swatch.color};
      font-size: ${size}px;
    }
  </style>
}
```

- A block style gets its own scope attribute, `b-c-<hash>-<n>`, on its elements and on those of the blocks inside it. The file's style keeps `b-c-<hash>`. The rules of a block join the stylesheet of the component, after the rules of the blocks around it, so the sheet still loads once per page.
- The custom properties of a block are `--s-<hash>-<n>-<k>`. They go on the top-level elements of each instance of the block, and a change sets them on the elements of that instance only.
- The server writes the values with the first render. After that, a value that changes in the browser updates the elements of its instance. A value that never changes ships no client code.
- Where the style is written decides what it reaches. See [A style in a block](./control-flow.md#a-style-in-a-block) for the scope rules.

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

A `<style global>` block in the root layout works too.

## On the page

In a build, the CSS of a component is not in its JavaScript. It goes through the CSS pipeline into `.css` assets, one per bundle of a route, plus shared chunks that several bundles use, and the files are cached across pages.

A page carries each component's CSS twice. The server writes the CSS of the components a page renders into the page, as `<style>` elements in render order, so the first paint needs no stylesheet request. The stylesheets of the bundles hold the same CSS for the rest of the visit, and a first load links them with `rel="preload"` and a `<noscript>` link, so they do not block the paint, when the page rendered the components whose global rules they hold. A sheet that holds anything else, such as a CSS file that a module imports, or a sheet whose component marks a plugin removed, stays a blocking link, and so does every sheet a navigation request gets. A component that the browser renders later gets its CSS from the bundle's stylesheet.

A client navigation waits for the stylesheets of the next page before it swaps the page, for at most 4 seconds, so no frame shows unstyled. A `#defer` body and a `#loading` body that the server streams wait for the stylesheets that their markup links before they show, for at most 4 seconds. Stylesheets that no element of the page uses any more are removed after a navigation.

The dev server keeps the CSS inline, and a hot update swaps the text of the `<style>`.

## What runs on component CSS

A build runs the project's CSS pipeline on the CSS of each component, after the compiler has scoped it. Vite runs these steps:

1. `url()` and `@import` resolve, and assets are rewritten to their built URLs.
2. PostCSS runs with the project's config (`postcss.config.js` or `css.postcss`), or Lightning CSS runs in its place.
3. The minifier runs with `build.cssTarget` as its browser targets.

`lang="scss"` and `lang="less"` compile first, in the compiler, before scoping.

The copy in the page is cut out of the built stylesheet, so it takes every step above, and the two copies are the same text. A plugin that removes or reorders the rules the build uses to find a component's CSS does not break the page: that component has no inline copy, and the page links the stylesheet, which blocks the first paint.

An `@import` in component CSS is inlined after the scoping, so its rules are global, not scoped to the component. A page links a sheet with such rules without deferring it.

With `css.transformer: 'lightningcss'`:

- Lightning CSS replaces PostCSS. Vite runs one of them, so the PostCSS plugins of the project do not run on component CSS, as on any other CSS file.
- `css.lightningcss.targets` lowers features in step 2. The minifier then reads `build.cssTarget` and can join them again, so set `build.cssTarget` to the same browsers. For example, `inset: 0` stays as `top`, `right`, `bottom` and `left` only when both name a browser that lacks `inset`.

The dev server, and a build with a relative `base` (`'./'`, where the server cannot link a stylesheet from a page at any depth), write the CSS inline only. They run steps 1 and 2 on each component's CSS through Vite's `preprocessCSS`, once per change of the file, so a PostCSS plugin shows in dev as it does in production. The minifier does not run in dev. Hot updates carry the transformed CSS.

- A change to a file that the CSS imports updates the component. A change to `postcss.config.js` needs a restart of the dev server, as in Vite.
- In dev, a relative `url()` names the file in the project, so it works on a page at any depth. In a build with a relative `base`, the page can be at any depth and the assets have no URL that fits all of them, so a `url()` stays as written. Use a root-relative URL from `public/` there.
- In dev and in a build with a relative `base`, a `url()` inside a file that the CSS imports is not rewritten.

[Style compilation](./style-compilation.md) explains how scoping and dynamic values are compiled.
