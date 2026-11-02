# Log: render-bundles-default

- 11-02: branch fix/render-bundles-default from origin/next 42047eea.
- Every render goes through `render()`, which read only `options.bundles`. `renderPage` is internal; `renderDeferred` passes `options.bundles` on.
- Option 1 taken. In a server build, the server version of each component ends with `import 'virtual:brumate/client-bundles'`, which calls the new `setClientBundles()` of `brumate/server` with the bundles of `clientHints()`: from memory after a client build in the same process (Nitro), else from `dist/client/.brumate/hints.json` (`vite build` twice). A component import is the one thing that every render of a page needs, so the default is set before any render, whatever the entry. The routes module imports it too and no longer embeds its own copy of the table (the website's `members` is 63 kB).
- `render()` and `renderDeferred` use `options.bundles ?? clientBundles`, so an explicit option wins. Dev (`isServe`) adds no import.
- The case option 1 cannot cover is a server built before its client. The routes module had the same gap. The server build now warns when it finds no `hints.json`, next to the warning for a missing build ID.
- Tests in bundle-urls.test.ts failed on next without the src changes (2 of 3 new tests: `b-load` empty), pass with them.
- `routeModule` lost its `bundles` parameter (unused now).
- Changesets: amended the unreleased one of #425 (its last sentence said a server must pass `bundles`); new minor one for `setClientBundles`.
- Checks: build, lint 0 errors, format:check, typecheck, brumate tests (devtools.test.ts failed 3 under load average 16, 13/13 alone). e2e todos 9/9, nitro 2/2, kit 5/5. Nitro's `.output/server/_chunks/ssr.mjs` holds the `setClientBundles({...})` call with the real chunk. measure-ui-sizes `none button` runs.
- Bench todos: 13.5 kB before `load`, click checks pass.
