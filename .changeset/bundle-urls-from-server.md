---
'brumate': minor
---

The client entry of a build no longer holds a table of every bundle of the app. The server names the bundles that a page needs, and their stylesheets, in the `b-load` attribute of its state records, for the first load, for client navigation and for `#defer` bodies. The new `brumate/bundles` module, which `virtual:brumate/manifest` re-exports, loads them. The website entry drops from 13.3 kB to 3.8 kB (gzip). A page links to the stylesheets of the bundles of its views in its head.

`start()` no longer takes `loadBundle`, and the manifest of a build exports only `load`. A server that calls `render()` itself must pass `bundles`, from `.brumate/hints.json` of the client build, or the page loads no client code.
