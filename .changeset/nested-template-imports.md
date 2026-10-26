---
'brumate': patch
---

A component used in a `#template` that is declared inside a block is imported in the client code of the page. Before, the browser threw a `ReferenceError` when it rendered that template.
