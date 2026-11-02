---
'brumate': patch
---

When two errors of one `#try` body arrive at the same time in the browser, such as two effects that throw in one update or two rows of a `#for` that fail at once, the `#try` now renders its `#catch` once and shows the first error, as the server does. Before, it rendered the `#catch` once per error and the last error stayed. `onError` still receives every error.
