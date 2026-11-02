# Inbox

Ideas parked for later triage. Each becomes a node, moves to another roadmap, or is dropped with a reason.

- 2026-11-01: Bundle size benchmarks against more frameworks: Svelte 5, SolidJS 2.0 RC, Preact, React and Vue, next to Marko 6 and Qwik in benchmarks/. Same pages as the current harness (todos, dashboard, rows). The maintainer said "later" and "probably"; no milestone yet.

- 2026-11-02, from bundle-urls-from-server (#425): no test covers a skew reload (a page built against an older deploy) for the server-named bundles, an acceptance item of the brief. Known limits in its outcome: a component the client renders first that no `.brm` import reaches has no client code; the loader does not wait for a stylesheet before the module runs.

- 2026-11-02, from render-bundles-default (#429): the client-bundles default is one module-global value, so two client builds in one process share the last one set (pass `bundles` explicitly); a stale `hints.json` (client rebuilt without the server) names old chunks with no warning, so a build ID check could warn; `setClientBundles` is a public export of `brumate/server` that only the plugin should call, so an internal path could hide it.

- 2026-11-02, from browser-root-boundary: the old body stays live during a hold, so a `#key` body that reads the key loads for the new key too (`[1, 2, 2]`); a held body whose memo never settles keeps its scopes until the block closes or switches; `reset`, `catchInto`, late `children`, `content`, the portal insert and loading-on's fallback insert still fill in place. The `rootWait` flag costs about 0.6 kB gzip on every page of an app with one browser `await $memo`.
