---
'brumate': minor
---

For readers that run no scripts, the server renders `#loading` and `#defer` bodies in place, in the order of the page, with no `<template>` and no swap. The page arrives later, complete, with the same state. `inOrder` in the options of `handle`, `render` and `renderToStream` decides: `'bots'`, the default, for requests whose `User-Agent` is a known crawler, `true`, `false`, or a function of the request.

`getEvent().signal` aborts when the request's signal does, or when the reader of the response goes away, for pages, server function calls and `#defer` requests. A page that the reader left sends no more `#loading` bodies.
