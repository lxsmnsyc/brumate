---
'brumate': minor
---

`$debounced(value, ms)` and `$throttled(value, ms)` from `brumate/signals` are memos that the browser writes after a wait: once the value stops changing for `ms`, or at most once every `ms`. On the server, both are the value itself. The memo is pending while it waits, so `$isPending` is true.
