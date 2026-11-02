# Inbox

Ideas parked for later triage. Each becomes a node, moves to another roadmap, or is dropped with a reason.

- 2026-11-01: Bundle size benchmarks against more frameworks: Svelte 5, SolidJS 2.0 RC, Preact, React and Vue, next to Marko 6 and Qwik in benchmarks/. Same pages as the current harness (todos, dashboard, rows). The maintainer said "later" and "probably"; no milestone yet.

- 2026-11-02, from bundle-urls-from-server (#425): no test covers a skew reload (a page built against an older deploy) for the server-named bundles, an acceptance item of the brief. Known limits in its outcome: a component the client renders first that no `.brm` import reaches has no client code; the loader does not wait for a stylesheet before the module runs.
