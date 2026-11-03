---
'brumate': patch
---

Fix the browser render module of a component that uses another component only in a `#template` inside a block (`#try`, `#if`, `#switch`, `#for`, `#key`, `#loading`): it now imports that component, where it threw `ReferenceError`.
