---
'brumate': patch
---

`<Child label=$untrack(fn) />` now ships `fn` to the browser and keeps the writes of handlers to the state it reads. Before, the page had no client code for `fn` and a handler such as `name = 'Grace'` compiled to a bare value, so the write was lost. The prop stays fixed, and the child gets the current value when it calls `fn`.
