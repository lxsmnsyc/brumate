# Style compilation

How the compiler scopes the CSS of a component, turns `${}` values into custom properties, and puts the stylesheet on the page. [Styles](./styles.md) describes what to write.

## Scoping

- Every native element of the component gets an attribute, `b-c-<hash>`, where the hash comes from the file name.
- Every compound selector gets `[b-c-<hash>]`, before any pseudo-element. `p` becomes `p[b-c-<hash>]`, and `.a > .b::before` becomes `.a[b-c-<hash>] > .b[b-c-<hash>]::before`.
- `:global(…)` leaves its selector as it is.
- Keyframe steps, such as `from` and `50%`, are not scoped.
- Elements that other components render do not get the attribute, so a component's styles do not reach into its children. `:global(…)` does.

## Variables

`${expression}` in CSS becomes a custom property, `var(--s-<hash>-<n>)`, where `n` is the index of the expression.

- Text that touches the expression is part of the value. `font-size: ${size}px` sets the property to `12px`, and the CSS reads `var(--s-<hash>-<n>)` alone, because `var(--x)px` is not valid CSS.
- `null`, `undefined` and `false` set no property.
- The top-level elements of the component set the properties in their `style` attribute, so the elements inside inherit them. An element's own `style` comes after them.
- Markup that the component renders outside its own elements counts as top level too: `children` passed to a component, and the markup of a `#template`.
- A top-level dynamic tag sets them as well. A component in a dynamic tag gets them as its `style` prop.
- When a value can change in the browser, the top-level elements get `b-v="<scope>"`. A change sets the property on each of them. A block that the browser renders later reads the current values.

## SCSS and Less

With `lang="scss"` or `lang="less"`, the preprocessor runs first, and the result is scoped as above.

- `${expression}` becomes `var(…)` before the preprocessor runs, so preprocessor functions see a `var()` and cannot compute with the value.
- `@use` and `@import` load files next to the component. `compile` needs the `path` option for it, which the Vite plugin passes.
- In development, the plugin watches the imported files, and a change compiles the component again.

## On the page

- The stylesheet is inlined once per page, as `<style b-style="<component ID>">`, before the first instance of the component.
- A component that the browser renders first adds its stylesheet to `<head>`.
- A page carries only the CSS of the components that it renders, so its CSS is the critical CSS. There is no CSS file with every component.
- When the browser loads another page and keeps its layouts, a stylesheet in a replaced route moves to the head if a component on the page still uses it. The others go with the route.

`compile` also returns the stylesheet as `css`.
