---
id: render-bundles-default
title: "A server that renders on its own gets the client bundles, or a clear error"
status: done
priority: must
type: fix
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent: 107000
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/bundles.ts
  - packages/brumate/test/bundle-urls.test.ts
  - website/docs/reference-server.md
  - website/scripts/measure-ui-sizes.mjs
reserves: []
provides: []
depends_on:
  - on: bundle-urls-from-server
    kind: hard
    why: "#425 made a server that calls render() itself pass `bundles`"
---

# A server that renders on its own gets the client bundles, or a clear error

## Goal

In a build, a server that calls `render()`, `renderToStream()` or `renderPage()` without `bundles` gets a page whose code loads, or fails loudly. Today it gets a page that names no bundles, so the loader loads nothing and the page stays static with no error (found by bench-server-bundles, #428).

## Context

- Since bundle-urls-from-server (#425, on `next`), the server names each page's bundles in `b-load`. `virtual:brumate/routes` passes `bundles` from `hints.json`; a server that renders on its own must pass them too, and nothing tells it when it does not.
- Proposal from #428's outcome, in order of preference:
  1. In a server build, the plugin makes the client build's bundles the default for `brumate/server`, as it does for the routes module.
  2. Otherwise, a build render with no `bundles` throws, or the loader logs an error when `load(id)` misses and no record on the page named a bundle. The plugin must tell the server it is a build, since dev needs no `bundles`.
- `website/scripts/measure-ui-sizes.mjs:89` also renders without `bundles` (it only measures, so it is not broken); keep it working.
- Document the rule in website/docs/reference-server.md.

## Acceptance

- [ ] A test in packages/brumate/test/bundle-urls.test.ts: a build server that calls `renderToStream()` without `bundles` either names the page's bundles or throws a clear error; dev is unchanged.
- [ ] The bench servers from #428 still pass their click checks.
- [ ] A changeset for brumate.

## Sizing

S: a default in the plugin or a check in the server, and tests.
