---
'brumate': patch
---

A rest prop, such as `...rest` in `const { label, ...rest } = $props()`, updates in the browser when the parent passes a new value of a prop that it holds. Before, a spread of the rest kept the values from the server, such as an `aria-pressed` that a parent changes.
