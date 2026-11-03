---
id: store-contract
title: The store contract and $store
status: todo
priority: should
type: feature
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
added: 2026-10-30
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
  - website/docs/context.md
  - website/docs/state.md
  - docs/decisions.md

reserves: []
provides: []
depends_on:
  - on: context-stores-spike
    kind: hard
    why: the spike fixes the API, the compile shape and the resume plugin
---

# The store contract and $store

## Goal

Step 2 of the approved context-stores debate (docs/debates/context-stores/debate.md): ship `brumate/store` (`Store` with `get`, `subscribe`, `set`, and a `store()` helper), `$store(ctx)` to read a store held in a context, and the seroval plugin, with the API and compile shape from context-stores-spike's outcome. One store per provider. A foreign store inside a context is refused on the server with an error that names the context. The live-context path still works; nothing in packages/ui changes yet.

## Acceptance

- [ ] The spike's resume and ordered-update cases pass as tests.
- [ ] Docs: website/docs/context.md (static values, stores for live ones), the API reference, and a docs/decisions.md entry replacing the "no `$store` yet" note.
- [ ] The compiler warns when a local `$signal`, `$memo` or `let` is read in a `$setContext` argument; `$untrack` silences it.
- [ ] Todos within 0.3 kB (todos reads no context).
- [ ] A minor changeset.

## Sizing

M.
