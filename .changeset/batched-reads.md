---
'brumate': minor
---

`batched(readMany, lookup, options)` from `brumate/batch` turns the calls of one moment in the browser, such as the rows of a list that renders, into one call with every key. On the server, each call reads its own key at once.

A component that the browser renders now calls the server functions of its memos once, instead of twice: the first compute of a memo takes the promise that the render made.
