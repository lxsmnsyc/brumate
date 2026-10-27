---
'brumate': minor
---

A handler is one pass. Its writes compute a memo when the handler reads it, and the bindings, such as the DOM text or an effect that reads two signals, run once when the handler returns. A state between two writes no longer shows or throws. `flush()` from `brumate/signals` runs the waiting bindings at once, for a handler that must focus or measure what it rendered. A handler also waits for the update code of its component, so its writes no longer run after it returns.
