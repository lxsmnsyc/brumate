---
'brumate': patch
---

A `$client(fn, 'visible')` without `ref` now waits for the first element after it, even when another `$client` comes first. Before, it watched the other callback's marker, which is never in view, so the callback never ran.
