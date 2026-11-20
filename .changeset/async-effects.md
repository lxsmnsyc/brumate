---
'brumate': minor
---

The callback of `$effect` and `$client` can be `async`. `BRM096` is removed. A run that goes stale cleans up as soon as it settles, one run goes at a time, a scope that goes does not wait for a pending run, and a rejection of the run or its cleanup goes to the nearest `#try`. A cleanup can also be an object with `[Symbol.dispose]` or `[Symbol.asyncDispose]`, in sync effects too.
