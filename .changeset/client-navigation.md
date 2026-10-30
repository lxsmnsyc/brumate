---
'brumate': patch
---

- A page that client navigation loads keeps its bindings and the handlers of its spreads. Before, a `$bind` or a handler passed through a spread wrote to the wrong scope.
- Client navigation no longer removes the attributes that a script set on `<html>`, such as a saved `data-theme`.
