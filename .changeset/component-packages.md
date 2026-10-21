---
'brumate': minor
---

- An app can use `.brm` components, `.brm.ts` modules and `'use server'` files from an npm package. The package opts in with a `brumate` field in its `package.json`, and the plugin of the app compiles its files.
- The IDs of the components and server functions of a package come from the package name and the path in it, so they stay the same however the package is installed.
- A server function of a package becomes an endpoint only when the app imports its file, directly or through the package.
- The plugin keeps these packages out of Vite's dep optimizer and compiles them into the server build.
