---
'brumate': patch
---

A dynamic tag that the browser renders keeps the handlers of its spreads. Before, `<{as} {...keys()} />` in a block that opens in the browser got no `b-on`, so a `$handler` from the spread never ran.
