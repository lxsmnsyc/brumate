---
'brumate': patch
---

A function prop whose name does not start with `on`, such as `filter`, now returns its result in the browser, as it does on the server. Its code loads with the page state. Before, every call returned a promise, so a child that called it in a memo or in markup got a promise instead of the result.
