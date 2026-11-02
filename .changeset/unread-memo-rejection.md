---
'brumate': patch
---

A component that the browser renders now handles the rejection of an async memo that nothing reads. The error goes to the nearest `#try`, or to `onError` and the `brumate:error` event when no `#try` catches it. Before, the page got an unhandled rejection.
