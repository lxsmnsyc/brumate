---
'brumate': patch
---

An error of code that fails to load no longer leaves an unhandled promise rejection. While the browser looked for the `#try` around the error, it loaded the code of the same component again, and that load failed too.
