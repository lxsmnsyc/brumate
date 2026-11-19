---
'brumate': patch
---

A memo or a function that the browser renders and that reads a property of a memo that is still loading waits for it, as the server does. It no longer reads `undefined` and throws a `TypeError`.
