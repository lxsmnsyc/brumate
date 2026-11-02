---
'brumate': patch
---

A `#try` whose body holds only a child component now catches the client errors of that child, such as a click handler that throws, an async handler that rejects or an effect that throws. Before, the error went past the `#catch` to `onError` and `brumate:error`, unless an element with a handler sat next to the child in the same `#try`. This also holds for a grandchild and for a child inside an `#if` or a `#for` in the `#try`.
