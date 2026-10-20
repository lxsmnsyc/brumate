# Styles

`<style>` blocks hold CSS that applies only to the component.

```html
<script>
  let big = $signal(false);
</script>

<style>
  p {
    color: ${big ? 'red' : 'blue'};
  }
  :global(body) .note {
    margin: 0;
  }
</style>

<p class="note">Hello</p>
<button onClick=(() => (big = !big))>Toggle</button>
```

## Scoping

- Every native element of the component gets an attribute, `s-<hash>`, where the hash comes from the file name.
- Every compound selector gets `[s-<hash>]`, before any pseudo-element. `p` becomes `p[s-<hash>]`, and `.a > .b::before` becomes `.a[s-<hash>] > .b[s-<hash>]::before`.
- `:global(…)` leaves its selector unscoped, as `:global(body)` above.
- Keyframe steps, such as `from` and `50%`, are not scoped.

## Variables

`${expression}` in CSS reads a value of the component. It becomes a custom property, `var(--s-<hash>-<n>)`.

- The top-level elements of the component set the custom properties in their `style` attribute, so the elements inside inherit them. An element's own `style` comes after them.
- The elements that markup outside the component's elements renders also count as top-level: children passed to a component, and the markup of a `#template`.
- If a variable can change on the client, the top-level elements get `data-v="<scope>"`. A change sets the custom property on each of them. A block that the client renders later reads the current values.

## SCSS and Less

`lang="scss"` and `lang="less"` compile the block with Sass or Less first. Then the CSS is scoped as above.

```html
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

- Install `sass` or `less` in the project. They are optional peer dependencies.
- `${expression}` works as in CSS, because it becomes `var(…)` before the preprocessor runs.
- An error of the preprocessor is a compile error.
- `@use` and `@import` load files next to the component. `compile` needs the `path` option for it, which the Vite plugin passes. In development, a change to an imported file compiles the component again and reloads the page.

## On the page

The stylesheet is inlined once per page, as `<style data-brm="<component ID>">`, before the first instance of the component. A component that the client renders first adds it to `<head>`.

`compile` also returns the stylesheet as `css`. With `css: 'external'`, the server and client code leave the stylesheet out, so a CSS file can hold it.

### One CSS file

`brumate({ css: 'file' })` builds the stylesheets of every component into one CSS file. Development still inlines them, so a page has its styles before any script runs.

- The client entry imports the stylesheets, so Vite writes the CSS file and lists it under `css` in the manifest entry of the client.
- The server links it in the head with the `head` option of `renderToStream` or of `handle`:

```ts
const css = manifest['src/client.ts'].css.map((file) => `<link rel="stylesheet" href="/${file}">`);
const response = await handle(request, { head: css.join(''), scripts });
```

## Not supported yet

- Style variables on dynamic tags.
