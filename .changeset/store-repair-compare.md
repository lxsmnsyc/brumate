---
'brumate': patch
---

A `$toStore` of an object memo, in a component that the browser renders, no longer rewrites its readers at creation. The memo made its object again, which ran the effects of the readers and created the item scopes of their lists a second time. An object with the same data as the store's value is not an update. `sameData` stops at a depth of 32, and a cycle counts as changed.
