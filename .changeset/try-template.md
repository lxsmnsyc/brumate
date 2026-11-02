---
'brumate': patch
---

A `#try` now catches the client errors of a `#template` that its body calls, such as a click handler that throws, an async handler that rejects or an effect that throws. Before, the error went past the `#catch` to `onError` and `brumate:error` in two cases: a template declared outside the `#try` and called in it, and a template in the `#try` that holds a component.
