---
'brumate': patch
---

A `$toStore` of an object memo, in a component that the browser renders, no longer rewrites its readers at creation. The memo made its object again, which ran the effects of the readers and created the item scopes of their lists a second time. The first update after the store is made is skipped when it holds the same data as the store's value. The compare of plain data ends on cycles.
