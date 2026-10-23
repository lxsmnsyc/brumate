---
'brumate': minor
---

Pages and data can be cached across requests, without one user's data reaching another.

- A route exports `cache` from its module script, such as `export const cache = { maxAge: 60, staleWhileRevalidate: 600 }`, and the server sends `cache-control` for the page. A layout's `cache` applies to the pages below it.
- A page is public only when the request did not read cookies or the `authorization` header and set no cookie, in middleware too. Otherwise it gets `private, no-cache`. A page with `cache` renders in full before its headers go out.
- `cached(fn, { maxAge, tags })` from `brumate/server` keeps the results of a function by its arguments. The function runs without the request, so `getEvent()` throws in it. A `'use server'` file can export a function that `cached` makes.
- The server keeps public pages too, and answers the next request for the same URL from them until `max-age` ends. Middleware still runs for each request. Pass `pageCache: false` to `handle` to turn it off.
- `revalidate(...tags)` drops the results and the pages that used a tag.
- Results and pages live in memory by default. `setCacheStore(storageStore(storage))` keeps them in an unstorage storage, such as Redis through Nitro's `useStorage()`.
