---
'brumate': patch
---

- An element with several spreads keeps the attributes of each when one of them changes in the browser, such as the `class` of a rest prop, and the attributes that other code set on it, such as an `aria-controls` that a `$client` callback added.
- An element with a `class` that changes and a spread with a `class` keeps the class of the spread when its own class changes.
- A spread whose handlers change gives the element its new handlers and their wrappers.
- A rest prop updates in the browser when the parent passes a new value of a prop that it holds.
- A rest prop leaves out the props that another `$props()` call of the component names, such as `open` in `const { label, ...rest } = $props(); let { open } = $props();`.
- A prop of `let` that the component writes updates its markup when every parent passes a constant, such as `<Menu open=(true) />`.
- A component with a `<style>` that uses `${}` values removes the `style` that a spread drops, also on the first update in the browser.
- A dynamic tag keeps the element that the server rendered when its scope updates after the page resumed.
- A computed attribute (`[name]=(value)`) whose name or value can change on a plain element or a dynamic tag no longer fails to compile with "This attribute cannot change on the client yet".
- A memo of an object literal, such as `$memo({ title })`, compiles in the browser.
