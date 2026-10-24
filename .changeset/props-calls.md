---
'brumate': patch
---

- A rest prop leaves out the props that another `$props()` call of the component names, such as `open` in `const { label, ...rest } = $props(); let { open } = $props();`. Before, a spread of the rest wrote `open` as an attribute.
- A prop of `let` that the component writes updates its markup when every parent passes a constant, such as `<Menu open=(true) />`. Before, its writes changed nothing on screen.
