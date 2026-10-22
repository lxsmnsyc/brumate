---
'brumate': minor
---

`#defer (trigger) { … } #else { … }` renders its body on the server in a later request. The page has the `#else` body until the trigger fires. The browser then asks the server for the body, which replaces the fallback. The request goes to the URL of the page, so middleware and cookies apply as they do for the page.
