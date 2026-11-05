---
id: has-context
title: $hasContext, and a guarded $store for contexts that may be missing
status: active
priority: must
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
added: 2026-11-05
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: [code BRM197]
provides: []
depends_on:
  - on: context-throw
    kind: hard
    why: $hasContext is the optional read for contexts that throw
---

# $hasContext, and a guarded $store for contexts that may be missing

## Goal

From the approved debate docs/debates/context-no-defaults/debate.md: a part that works without a provider (a Button outside any group) asks first. `$hasContext(C)` is a compile-time function in `brumate/signals` next to `$getContext` (add it to the list in decisions.md:7 and the skill reference), and returns a boolean, as `has` of Svelte's `createContext` triplet. The server walks the scope parents as `$getContext` does, and returns true for `ROUTE_KEY`. The browser uses `findProvider` on the page state, so the page state gains nothing. Providers are static, so the answer is fixed when the scope is made.

`$store` accepts its sources only (decisions.md:40, BRM194). Add one guarded shape and no new arguments:

```ts
const x = $hasContext(C) ? $store(C) : undefined;
const g = $hasContext(C) ? $getContext(C) : undefined;
const y = $hasContext(C) ? $store(g.state) : undefined;
```

The guard must name the same context as the source. Without a provider the variable is `undefined`, and nothing links on the server or in the browser. A `let` in the guarded form, or a guard on another context, is BRM197 with a message that shows the shape.

## Acceptance

- [ ] `$hasContext` on the server and in the browser, with a test for a provider rendered by the server, a provider made by a browser render, and a reader inside a streamed `#loading` chunk: both sides agree.
- [ ] The guarded `$store` shape binds with a provider and is `undefined` without one, for `$store(C)` and `$store(g.key)`; resume does not call `set` or rewrite the slot.
- [ ] BRM197 tests; `brumate check` reports it.
- [ ] Docs of `$hasContext` in website/docs/context.md, and the brm skill reference.
- [ ] A minor changeset.

## Sizing

M: compiler analysis, runtime on both sides, tests.
