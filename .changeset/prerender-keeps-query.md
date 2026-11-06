---
'brumate': patch
---

A prerendered page keeps its query string, and `$searchParam` reads the URL when the page loads. A signal that no handler writes also follows the URL now.
