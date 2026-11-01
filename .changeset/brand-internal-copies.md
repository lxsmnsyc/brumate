---
'brumate': patch
---

A `b-` attribute value that one copy of brumate made is now kept by another copy. Before, the runtime checked it with `instanceof`, so with two installed copies (a component library with its own brumate, or a hot update that evaluates the runtime again) a `b-` attribute was dropped from a spread and the value was left out of the page state.
