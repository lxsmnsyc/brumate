---
'brumate': patch
---

Remove the code-part loading that lazy loading left. A handler or an update no longer waits for a part of its module, and a build no longer emits the `w` export. Effects now also wait for writes that wait for code, so an effect such as the check of Tabs never sees a half updated page. The client is smaller.
