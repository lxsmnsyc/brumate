---
'brumate': patch
---

A signal that only the `ref` of a component binds, such as `<Toolbar ref=$bind(el)>`, may hold an element. The type check no longer reports "A function cannot be sent to the client" for it, as it does not for `ref` on an element.
