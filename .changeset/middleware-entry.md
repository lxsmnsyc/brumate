---
'brumate': minor
---

`src/middleware.ts` runs for every request of the app, before the `_middleware.ts` of the folders: pages, endpoints, server function calls, form posts and the requests for `#defer` bodies. Its default export, written with `defineMiddleware`, takes the `RequestEvent` and `next`. `event.kind` says what the request is for, and `event.call` has the server function of a call and its arguments. A `'use server'` file can export `middleware` for its own functions. The `middleware` option of the plugin names another file, or `false` runs none.

Middleware hands values to the rest of the request through `event.locals`, typed by the `Locals` interface of `brumate/server`, which an app adds fields to. `event.waitUntil(promise)` keeps work going after the response ends, through the `waitUntil` option of `handle` on hosts that have one.
