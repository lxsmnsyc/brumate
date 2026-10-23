---
'brumate': minor
---

A route can export `cache` from its module script, such as `export const cache = { maxAge: 60, staleWhileRevalidate: 600 }`, and the server sends `cache-control` for the page. A page is public only when the request did not read cookies or the `authorization` header and set no cookie, including in middleware. Otherwise it gets `private, no-cache`. Pages with `cache` render in full before their headers go out.
