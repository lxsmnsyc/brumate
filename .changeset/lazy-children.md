---
'brumate': minor
---

The children of a component render where the component inserts them, so they read the contexts that the component provides. A part passed into a component, such as a `Label` inside a `Select`, now reads the context of the `Select`, on the server and in the browser.
