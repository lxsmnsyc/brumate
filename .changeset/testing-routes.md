---
'brumate': minor
---

`visit(path)` from `virtual:brumate/testing` answers a path with the routes of the app and resumes the page in the DOM of a test. Links use client navigation, and forms, server function calls and `#defer` requests go to the same routes, with the cookies that the answers set. Responses of the server now keep their `set-cookie` headers in DOM environments such as happy-dom, which drop them from the headers that a response is made with.
