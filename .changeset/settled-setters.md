---
'brumate': patch
---

The browser runtime keeps the promises of the setters of `$bind(signal, setter)` until they settle, in an app that passes `$bind` to a component, so `@brumate/ui` can tell a refused write from one that a setter has not decided yet.
