---
'brumate': patch
---

A `ref` bound with a setter, `ref=$bind(root, fn)`, now calls `fn` with the element in the browser, for a component that forwards it by name or through its rest props. Before, the element was dropped. A named prop calls it on resume for server-rendered markup. Rest props do not yet.
