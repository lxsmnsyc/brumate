---
'brumate': minor
---

`transition(handler, ...types)` from `brumate/events` runs a handler inside a view transition, so the browser animates the change, such as an element that `#if` removes or a list that changes order. The transition waits for the update code of the first write. Without view transitions, or with `prefers-reduced-motion`, the handler runs as it is.
