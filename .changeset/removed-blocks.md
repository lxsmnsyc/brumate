---
'brumate': patch
---

- A block that removes a component removes the component's scopes too. Its effects run their cleanups, and the content of its `#portal` blocks leaves the page.
- A `$client` callback no longer runs after the block or the page that held it was removed.
- A loader that stopped no longer starts handlers or `$client` callbacks from markup that the core inserts later.
- A `$client(fn, 'visible')` without `ref` waits for the first element after it, even when another `$client` comes first.
