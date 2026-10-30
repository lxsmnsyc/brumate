---
'brumate': minor
---

Breaking: a handler is one update pass. Bindings run when the handler returns, and memo and binding errors go to the nearest `#try` in place of the handler that wrote.

- Its writes compute a memo when the handler reads it. The bindings, such as the DOM text or an effect that reads two signals, run once when the handler returns. A state between two writes no longer shows or throws.
- `flush()` from `brumate/signals` runs the waiting bindings at once, for a handler that must focus or measure what it rendered.
- A write runs each memo it reaches once, after the memos it reads, and then each binding once. The updates of a component run before those of the components inside it, so a child gets every new prop and context value before its memos compute.
- An error of a memo or a binding no longer stops the handler that wrote. It goes to the nearest `#try` around the code that threw. A write that has not settled after 10000 rounds, such as a loop through `ref=$bind`, stops with an error.
- A handler waits for the update code of its own component only, not for the code of the components above it, and a failed chunk goes to the nearest `#try`.
- Calls of the functions of other components, such as function props and provided functions, start in the order that they were made. The code of each still loads in parallel.
