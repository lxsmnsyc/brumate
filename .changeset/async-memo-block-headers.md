---
'brumate': patch
---

In a browser render, an `#if`, `#switch` or `#for` header, a component prop, or a function in markup that reads an async `$memo` whose input never changes now waits for the memo to settle. Before, it read the promise: an `#if (user.admin)` showed its `#else` body and kept it. The block, the component or the value now renders once the memo settles, and a rejection goes to the nearest `#catch`, reported once. Server renders do not change.
