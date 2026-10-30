---
'brumate': patch
---

A component that a page gives to a dynamic tag or to the `as` of a part, such as `<Tab as=Target>` or `<{as} label=(label) />`, behaves as a component written by name.

- The props that change reach it, also when a part passes `as` on to another part (`<Button {as}>`), when the page writes `as=(flag ? A : B)`, with a live spread or a computed attribute, and when the component names the prop in place of spreading the rest. Before, it kept the props of the server render.
- It keeps the handlers of its caller and of its spreads when the browser renders it. Several handlers of one event all run, in that order.
- A `class` of a spread adds to the class of the tag, such as `<{as ?? 'button'} class="part" {...rest}>`.
- A live style variable of a part updates on it.
- A component that a prop gets as a value, such as `as=Link`, renders in a block or a new `#for` item that the browser renders. The sender must import the component from a `.brm` file.
