# Log: bench-server-bundles

## 2026-11-02

- Worktree from origin/next f8848c37. `pnpm install`, `pnpm build`.
- Confirmed on next: `pnpm bench --only brumate --scenario todos` reports "Click to update" FAILED for counter, toggle and add, and the notes say every interaction failed.
- Cause: the page that `benchmarks/brumate/src/server.ts` renders has no `b-load` on its state record. `renderToStream()` got no `bundles`, so it named none, and the loader of the build (`brumate/bundles`) only imports what `b-load` names. `load(id)` then returns undefined, as for a component with no client code, and the clicks do nothing. No error in the browser.
- The JS sizes did not change: the adapter adds `<link rel="modulepreload">` for every chunk of `hints.json`, the bundle of the app included. The browser fetched the app chunk and never ran it. So the 13.5 kB and 22.9 kB that #425 reported count the app bundle.
- Fix: `benchmarks/brumate/adapter.js` reads `chunks`, `styles` and `members` from `hints.json`, the same fields that `virtual:brumate/routes` passes to `handleRoute`, and passes them to `page()` in the three servers, which pass them to `renderToStream()` as `bundles`.
- Examples: none calls `render()`, `renderToStream()` or `renderPage()` itself. Each `src/server.ts` re-exports `handle` from `virtual:brumate/routes`, which passes `bundles`. The Nitro example uses `handle` too. No gap there.
- Typecheck run during a bench run failed with a missing `brumate/dist/index.js`: the bench rebuilds packages/brumate. Checks run after the bench.
