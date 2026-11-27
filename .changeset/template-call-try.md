---
'brumate': patch
---

- A `#template` call that you keep in a signal or pass as a prop now throws into the `#try` around its insert in the browser when a change makes its markup throw, as it does on the server. The page shows the `#catch` body and no longer logs an uncaught error.
- A `#try` whose body inserts a signal or a prop now ships its `#catch` body, so the browser can render it for such an error.
