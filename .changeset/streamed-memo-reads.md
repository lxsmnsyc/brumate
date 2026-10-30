---
'brumate': minor
---

A handler, a handler prop or a `$client` callback that reads a memo that can lack a value (BRM182) is a compile error, unless `$isPending` guards the read or the memo is declared with `await $memo(…)`. A read the compiler cannot follow throws an error at run time into the nearest `#try`, and never gives a promise or `undefined`. An effect that reads a memo that is still loading skips that run, and runs again when the value arrives.
