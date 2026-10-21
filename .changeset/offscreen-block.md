---
'brumate': minor
---

- `#offscreen (visible) { … }` hides its body when `visible` is false and keeps it in the page, with its elements, form fields and state. A body that is hidden when the page renders is rendered in the browser the first time it shows.
- While the body is hidden, its effects, `$client` callbacks and `<window>` and `<document>` listeners do not run, and its portals are hidden too.
- `#defer` is reserved for a future block. Using it is a compile error.
