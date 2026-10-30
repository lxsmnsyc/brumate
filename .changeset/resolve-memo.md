---
'brumate': minor
---

Add `$resolve(memo, { timeout, signal })`, which waits until a memo is no longer pending and gives its value.

Breaking: a handler, a handler prop or a `$client` callback that reads an async memo with no value yet is a compile error (BRM182) unless `$isPending` guards the read or it is written as `await $resolve(memo)`. A read the compiler cannot follow throws into the nearest `#try` with a message that points to `$resolve`, and never gives a promise or `undefined`. An effect that reads a value that is still loading skips that run, and runs again when the value arrives or fails.
