---
id: dev-setup-in-plugin
title: The plugin sets up hot updates and the devtools for every client entry
status: todo
priority: should
type: feature
outline: false
milestone: features
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/dev-setup.test.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/loader.ts
  - packages/brumate/src/runtime/hot.ts
  - packages/brumate/src/runtime/devtools.ts
  - website/src/client.ts
  - website/docs/reference-plugin.md
  - website/docs/reference-server.md
  - website/docs/getting-started.md
  - website/docs/client-modules.md
reserves: []
provides: []
depends_on: []
---

# The plugin sets up hot updates and the devtools for every client entry

## Goal

The user never wires `brumate/hot` or `brumate/devtools` by hand. The plugin's `devtools?: boolean` (default true) and hot updates already work for an entry that imports `virtual:brumate/start`. A client entry that calls `start()` from `brumate/loader` itself must wrap its `load` in `hotLoad(import.meta.hot, load)` and call `installDevtools` on its own (see website/src/client.ts, which calls `installDevtools()` without the endpoint, rpc, versions and `import.meta.hot` that the plugin passes). Make the plugin set up both on the dev server for such an entry too, so the entry only calls `start({ load, ... })`.

## Context

- The start module the plugin generates is in vite.ts (the `\0virtual:brumate/start` load, near "The devtools listen to the core before it starts").
- One way: on the dev server the plugin gives `start` a dev hook (a virtual module the loader imports, or a transform of the entry) that wraps `load` with `hotLoad` and installs the devtools with the same arguments as the start module. Pick what costs nothing in a build.
- `hotLoad` and `installDevtools` stay exported for code that needs them, but the docs no longer tell users to call them.
- Asked by the maintainer on 2026-10-27.

## Acceptance

- [ ] A client entry that calls `start({ load })` itself gets hot updates of components and the devtools button on the dev server, with no import of `brumate/hot` or `brumate/devtools`.
- [ ] `devtools: false` turns the devtools off for that entry too.
- [ ] Nothing of hot or devtools ships in a build: the gzip of todos and of a custom-entry page does not change (`pnpm bench --only brumate --scenario todos --metrics dist`).
- [ ] website/src/client.ts drops its own `hotLoad` and `installDevtools` calls, and the docs (reference-plugin, reference-server, getting-started, client-modules) no longer ask for them.
- [ ] A test covers the custom entry on the dev server and in a build.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one plugin change, a loader hook, docs and a test.
