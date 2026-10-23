---
'brumate': minor
---

The server keeps pages that `cache` makes public, in the store of `cached`, and answers the next request for the same URL from it until `max-age` ends. `revalidate(tag)` drops the pages that called a `cached` function with the tag. Middleware still runs for each request. Pass `pageCache: false` to `handle` to turn it off.
