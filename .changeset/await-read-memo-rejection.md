---
'brumate': patch
---

A browser render now handles the rejection of an async memo that the script reads only with `await`, as in `await side;` or `$memo((await side).length)`. The browser compiles `await side` to a plain read of the promise, which dropped it, so the rejection was unhandled. It now goes to the nearest `#catch`, or to `onError` and the `brumate:error` event.
