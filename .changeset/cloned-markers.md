---
'brumate': patch
---

More of the markup that the browser renders clones a template: bodies with text between static text, and with `#if` and `#for` blocks inside. A text value in a clone is a text node with no markers around it, which an update sets.
