---
'brumate': minor
---

`brumate/server` exports `setClientBundles()`, which sets the bundles that a render names when its options pass none. The Vite plugin calls it in a server build with those of the client build, and warns when the server build finds no `.brumate/hints.json` of a client build.
