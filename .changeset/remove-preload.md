---
'brumate': minor
---

The code of a page loads when it starts, so the features that loaded code early are removed:

- The `prefetch` attribute is a compile error.
- The loader no longer preloads handlers on hover, near the viewport or when the browser is idle, and the `preload` option of the plugin and the loader is gone.
- `brumate report` no longer lists what each handler loads, and `budget.event` is gone. A component in a bundle counts its share of the bundle.
- The devtools have no Loading tab.

`data-prefetch="none"` on a link still turns off the prefetch of its page for navigation.
