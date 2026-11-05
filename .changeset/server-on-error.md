---
'brumate': minor
---

`src/middleware.ts` can export `onError(error, info)`. The server calls it, in place of `console.error`, with each error that is not a `ServerError`: a page, an endpoint, a server function call or form post, a `#defer` body, and a `#loading` body after the response started. `info` has the `event` and the `kind`, and `ServerErrorInfo` comes from `brumate/server`.
