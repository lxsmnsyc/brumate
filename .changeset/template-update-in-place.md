---
'brumate': patch
---

A `#template` of the same file that markup calls, such as `{row(item)}` in a `#for`, now updates its elements in place when the same template renders again at the same insert. Before, each update replaced them, so an `<input>` in the template lost its focus, caret and typed value. A different template, or a value that is not a template, still replaces the markup.
