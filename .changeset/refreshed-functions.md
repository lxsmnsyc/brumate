---
'brumate': patch
---

A memo that calls a server function of a `'use server'` file renders on the server only, unless the app passes that function to `refresh` somewhere. Before, every such memo sent its value to the browser with update code, in case a call refreshed it.
