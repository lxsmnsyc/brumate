---
'brumate': patch
---

A component that the browser renders runs each `$memo` once, as the server does. A memo that throws holds its error until it is read, so a `#try` around the read catches it. A `$debounced` value is not pending, and a function prop does not run again, right after the render.
