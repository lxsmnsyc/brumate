---
'brumate': minor
---

`await $memo(...)` waits in the script of a block body and of a `#for` row that the browser renders, and `await name` in markup waits at the start of the markup. The loads of awaited memos start where the server starts them, so two independent loads run at the same time.
