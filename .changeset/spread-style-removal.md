---
'brumate': patch
---

A component with a `<style>` that uses `${}` values removes the `style` that a spread on its element drops, also on the first update in the browser. Before, the style from the server stayed until a later update.
