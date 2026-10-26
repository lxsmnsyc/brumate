---
'brumate': minor
'@brumate/ui': patch
---

`mount` and `visit` of `brumate/testing` install an IntersectionObserver that reports each observed element as visible, so `$client`, `#client` and `#defer` with `'visible'` run in a test. The `offscreen` option keeps elements out of view until `reveal(selector)` brings them in, and the observer of the environment is put back on unmount. `'idle'` fires on a timer after the page starts. The parts of `@brumate/ui` that waited for no one use `'visible'` or `'idle'` where the page allows it.
