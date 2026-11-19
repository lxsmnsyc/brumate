---
'brumate': patch
---

A page loads again after a deploy that removed its bundles. When a bundle that the server named fails to import, `load` rejects instead of resolving to nothing, so a click on a handler reaches the skew reload, or reports the error when the build is the same.
