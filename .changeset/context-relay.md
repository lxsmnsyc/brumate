---
'brumate': patch
---

A component that reads a context and provides the same context again updates when the value above it changes, and so do the components that read its value. Before, the browser took it for the provider of its own read, so neither changed. `$getContext` now always reads from the scopes above the reader, on the server and in the browser, as the docs say.
