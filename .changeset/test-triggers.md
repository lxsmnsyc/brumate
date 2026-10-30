---
'brumate': minor
---

`mount` and `visit` of `brumate/testing` install an IntersectionObserver that reports each observed element as visible, so `$client`, `#client` and `#defer` with `'visible'` run in a test. The `offscreen` option keeps elements out of view until `reveal(selector)` brings them in. `'idle'` fires on a timer after the page starts.
