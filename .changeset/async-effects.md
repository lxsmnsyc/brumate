---
'brumate': minor
---

- The callback of `$effect` and `$client` can be `async`. `BRM096` is removed.
- One run of an async effect goes at a time.
- A stale run cleans up as soon as it settles.
- A scope that is removed does not wait for a pending run.
- A rejection of the run or of its cleanup goes to the nearest `#try`.
- A cleanup can be an object with `[Symbol.dispose]` or `[Symbol.asyncDispose]`, in sync effects too.
