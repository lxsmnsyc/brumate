---
'brumate': patch
---

A handler that writes only the state of its own component waits for the update code of that component, not for the code of the components above it. A slow or failed chunk of a parent no longer delays an unrelated handler. When the code of a write that waits for code fails to load, the error goes to the nearest `#try` and the effects that waited for it run. Before, they stayed queued until the next update.
