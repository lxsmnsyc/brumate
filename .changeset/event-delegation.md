---
'brumate': patch
---

Fixes how the loader runs handlers. `:capture` handlers now run before the handlers of the elements inside. An event that does not bubble, such as `focus` or `mouseenter`, no longer runs the handlers of the elements around its target. `:prevent` on `wheel` and `touchmove` now prevents: the listener of a type is passive only while no handler of the type prevents, so `:passive` is no longer needed.
