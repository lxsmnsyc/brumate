---
id: bundle-urls-from-server
title: The server sends the bundle URLs of a page, and the client entry drops its bundle tables
status: todo
priority: must
type: refactor
outline: false
milestone: 0.5.0
target:
from:
size: L
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
owns: []
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/client/resume.ts
  - packages/brumate/src/runtime/routes.ts
  - packages/brumate/src/runtime/server.ts
reserves: []
provides: []
depends_on:
  - on: drop-preload-helper
    kind: hard
    why: both rewrite the bundle table that vite.ts manifest() emits into the client entry
  - on: next-branch
    kind: hard
    why: minor work targets next
---

# The server sends the bundle URLs of a page, and the client entry drops its bundle tables

## Goal

The client entry holds two tables of every bundle of the app (vite.ts `manifest()`, about lines 903-960): `bundles` (root id -> `() => import(url)`) and `owners` (component id -> root). Their size grows with the app, not with the page. Have the server send the URLs a page needs, so the entry holds only the loader.

## Context

- Website, 2026-11-01 (351 bundles, 468 components): `bundles` is 27.1 kB raw / 7.4 kB gzip without Vite's wrappers, `owners` 22.8 kB raw / 5.8 kB gzip, on every page. drop-preload-helper already drops the identity entries of `owners` (3.8 kB gzip); this node takes the rest, about 9 kB gzip. Todos has one bundle, so it gains about 0.1 kB.
- The server knows the roots of a page (`bundleHints` in runtime/routes.ts, server.ts) and `.brumate/hints.json` has `bundles[root][0]` as each bundle's URL. Emit a root-or-owner -> URL map for the `m` ids in the b-state of the HTML, of partial navigation responses and of `#defer` bodies. `loadBundle(id)` becomes `import(url)`. The owner map stays in the server build.
- boot.ts `loadBundles` scans b-state with a regex and resume.ts calls `loadBundle` again (deduped). Both read the URL map instead.
- A per-page `<script type=importmap>` does not work: navigation cannot add import maps after modules load.
- Open risk: a component with a record `m` and no client-code root above it on the page, rendered later by a branch, a prop value or `#defer` from a bundle not yet loaded. The server map must cover every component its markup can render, or the client needs a fallback.
- Dev mode uses another `manifest` path; it must keep working.

## Acceptance

- [ ] The built client entry has no table of bundles or owners; the website entry is near the loader size (about 4 kB gzip) after drop-preload-helper.
- [ ] Tests: navigation to a page with new roots, `#defer` with a component from another bundle, a child bundle, a skew reload, dev and hot updates.
- [ ] e2e passes, website checked in a browser.
- [ ] Sizes of the website entry and of todos recorded.
- [ ] Changeset.

## Sizing

L: server, client and plugin change together, with edge cases in navigation and `#defer`. Split if the server map and the client loader can land apart.
