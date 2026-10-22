---
'brumate': minor
---

`await` says where the server waits instead of streaming. `const name = await $memo(value)` declares a memo that the page waits for where it is declared, and `await name` of a memo waits for it in the render around the read: the page, the `#loading` body around the block, or the request for a `#defer` body. A run of `await $memo` declarations, one after another, loads at the same time. In the browser the value is settled, so both are plain reads.

A `#loading` body whose values are ready when the block renders, and that renders no component, dynamic tag, template or prop, renders in place: no fallback, no swap, and its scopes are in the page state. A page that waits for every value it loads has one state record.

A component whose script awaits a promise rendered a broken render module. It now renders on the server only, and the browser throws a clear error when it renders the component. An `await` of a promise in markup that the browser renders or updates is a compile error.
