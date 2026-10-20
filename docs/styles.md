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

## On the page

The stylesheet is inlined once per page, as `<style data-brm="<component ID>">`, before the first instance of the component. A component that the client renders first adds it to `<head>`.

`compile` also returns the stylesheet as `css`, for a bundler that writes CSS files.

## Not supported yet

- `lang="scss"` and `lang="less"`.
- Style variables on dynamic tags.
