---
'brumate': minor
---

- Scope attributes add no specificity. File styles and block styles scope a selector with `:where([b-c-<hash>])` instead of `[b-c-<hash>]`.
- `.a .b` keeps the specificity (0,2,0) it was written with.
- A scoped rule now loses to a later global or parent rule of the same written specificity. In 0.8, the scope attribute made it win.
