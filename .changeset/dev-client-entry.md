---
'brumate': patch
---

- The dev server loads the client entry of the app, the `input` of the client build, so its own code runs as it does in a build. Before, the pages loaded only the start module.
- An app with no client entry still gets the start module.
