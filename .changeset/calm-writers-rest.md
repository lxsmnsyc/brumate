---
'brumate': patch
---

An effect in a child that calls a writer of a context no longer runs again on its own write. A `$setContext` object that holds a function which writes state outside `$untrack` is now sent again only when a value it holds itself changes, not when a function in it reads state. Before, the effect ran without end and the tab hung.
