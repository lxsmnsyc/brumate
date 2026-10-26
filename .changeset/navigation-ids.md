---
'brumate': patch
---

A page that client navigation loads keeps its bindings and the handlers of its spreads. Navigation moves the scope IDs of the new page, and it now moves them in the handlers of spreads in `b-on`, in bound props, in provided values, in the items of lists and in the scopes of inserted children. Before, a `$bind` or a handler that a component passed through a spread wrote to the wrong scope on such a page.
