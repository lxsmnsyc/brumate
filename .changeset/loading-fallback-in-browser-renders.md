---
'brumate': minor
---

`#loading` shows its `#else` in markup that the browser renders, such as a branch of an `#if` that opens or a row that a `#for` adds, while a memo that its body waits for loads, then the body, as a streamed block does. A memo of a child component counts too. Later updates keep the content. `#reveal` orders such blocks, also those of the components inside it, and a body whose load fails keeps its fallback and reports the error to the nearest `#catch`.
