---
'brumate': patch
---

Children that the server rendered work each time a block shows them again.

- Their handlers work after the block closes and opens again. Before, a click threw an error.
- A `ref` among them points at the element on the page, not at the one that left it.
