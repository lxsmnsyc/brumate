---
'brumate': minor
---

Scope attributes add no specificity. A scoped selector is now written with `:where([b-c-<hash>])` instead of `[b-c-<hash>]`, in file styles and block styles, so `.a .b` keeps the specificity (0,2,0) it was written with. A scoped rule that used to win over a global or parent rule of the same written specificity, because of the extra weight of the scope, now loses to it when it comes later in the page.
