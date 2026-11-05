---
id: context-throw
title: createContext takes only a key, and $getContext throws without a provider
status: active
priority: must
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/brumate/src/runtime/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: static-contexts-final
    kind: hard
    why: both edit runtime/client/context.ts
---

# createContext takes only a key, and $getContext throws without a provider

## Goal

The first node of the approved debate docs/debates/context-no-defaults/debate.md. A default value is module-global, so a `store(null)` default is one object shared by every request on the server; contexts are meant to be local. Follow Svelte 5.40: `createContext(key)` takes only a key, and `Context` has only `key`. `$getContext(C)` throws a named error carrying the key when no provider above set the context, on the server (server.ts, about line 805) and in the browser (client/context.ts, about lines 62, 129 and 237).

Delete what only served defaults: the `CONTEXT_ADDED` hook in runtime/context.ts, and `madeContexts` and `waitingReads` in client/context.ts. `routeContext` and `navigationContext` lose their defaults; the runtime provides both to every page, so a test root that reads `$route()` or `$navigation()` must provide them.

Work on a branch from feat/context-stores. packages/ui still passes defaults until the ui-no-defaults nodes, so its typecheck may fail here; keep `packages/brumate` green and say so in the outcome. Update the 24 `$getContext` calls in packages/brumate/test that rely on a default.

## Acceptance

- [ ] `createContext` has one parameter; `Context` has no `defaultValue`; no runtime code reads one.
- [ ] A test on the server and one in the browser: a read with no provider throws an error whose message names the key.
- [ ] `$route` and `$navigation` still read on every page.
- [ ] `CONTEXT_ADDED`, `madeContexts` and `waitingReads` are gone; todos client JS before and after recorded.
- [ ] A minor changeset (a 0.x break).

## Sizing

M: runtime on both sides plus the brumate tests.
