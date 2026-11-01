---
'brumate': patch
---

Remove the code-part loading that lazy loading left. A handler or an update no longer waits for a part of its module, and a build no longer emits the `w` export. The client is smaller.
