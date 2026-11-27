---
'brumate': patch
---

- A `#defer` block in the children of an overlay from another file is a compile error (BRM217). Such a block never loaded its body.
- `analyzeProjectDefers` finds these blocks across a project. The Vite plugin and `brumate check` use it.
