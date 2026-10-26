---
'brumate': patch
---

Client navigation moves the scope IDs of a bound prop. Before, the `ref` and `set` of a `Binding` in the page state kept their old IDs, so a write went to a scope that was gone or to a scope of another page.
