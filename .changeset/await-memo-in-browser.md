---
'brumate': minor
---

`await $memo(...)` waits in the script of a component, a block body or a `#for` row that the browser renders. `await name` waits at the start of its markup. The code before an `await` runs once, and the component or body fills its place when the memo settles. The loads of awaited memos start where the server starts them, so two independent loads run at the same time. A load that fails goes to the nearest `#catch`, also when a `#try` body waits.
