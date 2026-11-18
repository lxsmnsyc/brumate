---
'brumate': minor
---

- `getEvent().nonce` is the Content Security Policy nonce of the render, from the `nonce` option of `render`, `renderToStream` and the routes `handle`. A component that writes an inline script with `raw()` gives it this nonce.
