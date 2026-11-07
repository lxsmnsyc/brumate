# Inbox

Ideas parked for later triage. Each becomes a node, moves to another roadmap, or is dropped with a reason.

- 2026-11-01: Bundle size benchmarks against more frameworks: Svelte 5, SolidJS 2.0 RC, Preact, React and Vue, next to Marko 6 and Qwik in benchmarks/. Same pages as the current harness (todos, dashboard, rows). The maintainer said "later" and "probably"; no milestone yet.

- 2026-11-02, from bundle-urls-from-server (#425): no test covers a skew reload (a page built against an older deploy) for the server-named bundles, an acceptance item of the brief. Known limits in its outcome: a component the client renders first that no `.brm` import reaches has no client code; the loader does not wait for a stylesheet before the module runs.

- 2026-11-02, from render-bundles-default (#429): the client-bundles default is one module-global value, so two client builds in one process share the last one set (pass `bundles` explicitly); a stale `hints.json` (client rebuilt without the server) names old chunks with no warning, so a build ID check could warn; `setClientBundles` is a public export of `brumate/server` that only the plugin should call, so an internal path could hide it.

- 2026-11-02, from browser-root-boundary: the old body stays live during a hold, so a `#key` body that reads the key loads for the new key too (`[1, 2, 2]`); a held body whose memo never settles keeps its scopes until the block closes or switches; `reset`, `catchInto`, late `children`, `content`, the portal insert and loading-on's fallback insert still fill in place. The `rootWait` flag costs about 0.6 kB gzip on every page of an app with one browser `await $memo`.

- 2026-11-03, from release-0.5 (#434 CI): two `resume.test.ts` tests each failed once in CI and passed on a rerun and 5 of 5 locally. On Node 22, "reads a memo created in the browser as pending until its first load lands" saw `['handler', 'Ada']`: since blocks hold their new body, the load can land before `.read` shows, so the test races. On Node 24, "shows a pending memo of a promise prop as empty text in a textarea" saw an empty textarea after the held body showed; the test reads the value once after `waitFor` finds the element, so it may be a test race or a late value write.

- 2026-11-05, from the has-context review: resume.test.ts "a dynamic tag that spreads the rest props > gives the element of a component in as, and of an element after as changes" fails locally (`expected '' to be 'none'`) on main and on feat/context-stores before and after the no-defaults nodes, alone with `-t`; CI on main passes at the same source (611fcf6e). Local environment, not chased. Also: brumate-tsc adds `!` to a guarded `$store(g.key)` even when the guard names another context than g's guard; the compiler still reports BRM197, so only the type-only path is silent.

- 2026-11-07, from the missing-attributes review: several enumerated attributes that HTML matches case-insensitively are typed lowercase only, so `dir="LTR"` or `type="Submit"` fails the type check, and `translate=""` (valid HTML) fails the `yes | no` type. On the base before missing-attributes too.

- 2026-11-07, from release-0.7: resume.test.ts "a ref left in the rest props reaches the element that spreads them" (and its cast twin) waits a fixed 300 ms after the click, so it fails under load (`expected '' to be 'BUTTON'`). Use `waitFor`.
