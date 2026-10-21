---
'brumate': patch
---

- `answerCalls()` from `virtual:brumate/testing` answers the server function calls of a component test with the real server functions, in the test process. It returns a function that restores `fetch`.
- In a DOM test, the server version of a component (`?brumate-server`) and `virtual:brumate/server` now import the server code of `'use server'` files, not the browser stubs.
