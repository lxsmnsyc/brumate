---
'brumate': patch
---

A `ref=$bind(x, fn)` that reaches an element through the rest props of a component now calls `fn` once on resume, for markup the server rendered.
