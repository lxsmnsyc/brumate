---
id: derived-stores
title: derived() for module-level stores
status: todo
priority: could
type: feature
story:
early: false
outline: true
milestone: 0.8.0
target:
ship: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: store-contract
    kind: hard
    why: derived() builds on the Store class and the queued write of foreign stores
---

# derived() for module-level stores

## Goal

`brumate/store` exports `derived(sources, fn)`, as in Svelte 4: a read-only store computed from other stores, for state that lives at module level, outside any component. Inside a component, `$toStore` over a `$memo` covers the same need (context-stores-spike).

```ts
export const cart = store([]);
export const total = derived([cart], ([items]) => sum(items));
```

## Context

- Approved by the maintainer on 2026-11-05, deferred to 0.8.0 because no ui part needs a module-level store: every live context comes from a provider.
- It runs outside the update queue, so it follows the rule for foreign stores (docs/debates/context-stores/debate.md, O10): readers get the value through the queued context send, or the diamond cases of ordered-updates fail.
- Resume: it sends nothing. The browser computes it again from its sources, as the spike's gate for module-level stores changed since the server render requires.
- It must tree-shake: an app that does not import it ships none of it. Measure the gzip when it is built.
- Open for the refine: one source or an array of them, and whether `fn` may set the value asynchronously (Svelte's `set` argument).

Outline: not broken into a brief yet. Refine it when a release takes it.
