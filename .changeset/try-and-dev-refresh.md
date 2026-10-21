---
'brumate': patch
---

- A `#try` body that throws while the server renders no longer leaves its scopes in the page state. The browser could update them, and fail, such as after a client navigation.
- In development, `event.refresh(fn)` in a component's server function now refreshes a function of a `'use server'` file, as it does in production.
