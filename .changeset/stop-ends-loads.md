---
'brumate': patch
---

A page that stopped no longer links its scopes to module stores, renders a block or shows an error from code that finishes loading later. Before, a late load could subscribe the old scopes to the stores of the next page.
