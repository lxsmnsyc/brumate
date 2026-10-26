---
'brumate': patch
---

A spread that changes in the browser keeps the attributes that other code set on its element, such as an `aria-controls` that a `$client` callback added. Before, its first update removed every attribute that was not the element's own.
