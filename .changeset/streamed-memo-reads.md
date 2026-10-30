---
'brumate': patch
---

Effects and handlers no longer read the promise of a memo that is still loading. An effect that reads it skips the run and runs once the value arrives, and a handler gets `undefined` until the first value.
