---
'brumate': patch
---

Markup that streams in after a write, such as a `#loading` body, now keeps the templates that it renders. Before, its updates could run before the code of a template loaded, and the template rendered nothing.
