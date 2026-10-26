---
'brumate': patch
---

An effect no longer runs again when a value that only its cleanup reads changes, as in Svelte and Solid. Before, a cleanup such as `return () => release(panel)` made the effect run again each time `panel` changed.
