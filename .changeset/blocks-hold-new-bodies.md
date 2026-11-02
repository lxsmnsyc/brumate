---
'brumate': minor
---

Outside every `#loading`, a block that the browser renders holds its new body until the memos it waits for settle, as the server holds the page. A branch of an `#if` or `#switch`, a `#key` body, a `#client` body and the fallback of a `#for` keep what they show until then, and a new row of a `#for` shows when it settles. A switch back during the wait drops the held body, and a switch to it again before it settles takes it back without a second load. It is on in a build where a component that the browser renders waits at `await $memo(...)`. With it on, the script of a new body runs before the cleanups of the old one, and its effects and `$client` callbacks after them.
