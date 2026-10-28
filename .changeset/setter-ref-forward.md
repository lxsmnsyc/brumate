---
'brumate': patch
---

A `ref` bound with a setter, `ref=$bind(root, fn)`, now calls `fn` with the element in the browser, for a component that forwards it by name or through its rest props. Before, the element was dropped. The setter does not run for markup that the server rendered.
