# Log: prerender-search-params

- Reproduced in packages/brumate/test/search-params.test.ts: render at `/list`, resume at `/list?q=cats&page=4&tab=b&note=hi`. It failed on main.
- First fix in `paramEffect`: on the first run of a slot (tracked in a `WeakMap<Scope, Set<number>>`), write the signal from the URL instead of queueing a `commit`. A per-call closure flag did not work, because the effect is set up again on each run and every write then reset the signal.
- The test still failed for `note`, a parameter that no handler writes. The compiler gave such a signal no client slot or binding (`packages/brumate/src/graph.ts`, live values), so nothing read the new value. This is the case in issue #466 (`{category ?? 'all'}`). A `$searchParam` without `server: true` is now live (`followsUrl`).
- e2e: new prerendered page examples/tracker/src/routes/from.brm, added to `prerender.paths`. The tracker suite opens `/from?from=docs`. It fails on main and passes with the fix.
- Found while probing: a prerendered page with a client-written signal and a `#defer` that reads a context shows the signed-out text after load (tried on /about with a `$client` write). Not caused by this change. Not fixed here.
- Sizes (sum of `gzip -9` of `dist/client/**/*.js`): examples/todos 39239 to 39285 bytes, examples/ui 199062 to 199057 bytes.
