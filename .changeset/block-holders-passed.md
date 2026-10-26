---
'brumate': patch
---

The bodies that the browser adds to a block in the children of a component read the contexts of the component where the children are finally inserted, also when other components pass them on. This holds for `#offscreen`, `#client`, `#try` and `#portal` bodies too.
