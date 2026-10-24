---
'brumate': patch
---

A `$client` callback no longer runs after the block or the page that held it was removed, such as a callback for when the browser is idle. Before, it ran with no state and threw an error.
