---
'brumate': patch
---

An `#else if` whose condition never changes, such as a `$isPassed` const, now works in the browser after a condition before it changes. Before, the browser had no value for it and threw.
