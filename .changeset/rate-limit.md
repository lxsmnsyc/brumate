---
'brumate': minor
---

`rateLimit({ max, window, key? })` from `brumate/server` limits how often a client can call a server function. Called first thing in the function, it counts the calls of each key in a sliding window and rejects the ones over the limit with a `RateLimitError`: status 429, `Retry-After`, and `retryAfter` in the browser. `rateLimit.middleware(options)` limits every request under a folder of routes, or of the app from the entry middleware. `rateLimit.strict` is a preset for sign-ins. The counts live in memory, or in a store with an atomic increment, such as Redis, through `configureRateLimit({ store })`. `clientAddress(event)` reads the address of the client from the server, which passes it to `handle` as `address`, or from `X-Forwarded-For` past the proxies that `configureRateLimit({ proxies })` names. Limits are off outside production.
