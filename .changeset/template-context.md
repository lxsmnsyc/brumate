---
'brumate': patch
---

A `#template` that a component passes to a child, and that the child calls, now reads the contexts of the child in a browser render, as it does on the server and on a resumed page. Before, it read the contexts where the template is written, so a context that the child provides was missing or read as its default.
