---
'brumate': patch
---

A component that leaves `ref` in its rest props and spreads them onto an element gives the element to the signal that the parent bound with `ref=$bind(name)`. This holds for the server render, for markup that the browser renders, and when the rest changes.
