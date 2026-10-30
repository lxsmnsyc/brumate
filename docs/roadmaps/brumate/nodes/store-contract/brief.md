---
id: store-contract
title: The store contract and $store
status: todo
priority: could
type: feature
outline: true
milestone: 0.6.0
target:
from:
size: L
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# The store contract and $store

## Goal

A store contract for state that lives outside a component, and `$store` to bind one in a component. Any object that follows the contract works, so brumate can read state from other libraries, and a component can expose its own state the same way:

- `subscribe(callback): cleanup`: calls back when the value changes, returns a function that stops it.
- `get()`: returns the current value.
- `set(value)`: optional; with it the binding is two-way.

`let count = $store(source)` reads the store as a reactive value and tracks it like a signal; `count = 5` (or `count += 1`) calls `set`; `const count = $store(source)` is read-only. The subscription is cleaned up when the component goes away.

Design basis: silmaril (local checkout at ~/Documents/GitHub/silmaril, README "Stores": `silmaril/store` and `$store` with `subscribe`/`get`/`set`). Prior art: React's `useSyncExternalStore` (subscribe plus getSnapshot, no tearing), Svelte 3 stores (`subscribe`, `set`, `update`, and the `$store` auto-subscription).

## Context

- Asked by the maintainer on 2026-10-30 for a later version.
- docs/decisions.md says "There is no `$store`." This node changes that decision with the maintainer's approval; record the new decision there.
- Name (the maintainer, 2026-10-30): this node keeps `$store`. store-lens-spike's path-tracked store gets a new name through a goal debate later.
- Questions for the refine: the server render (read `get()` once, never subscribe); resume (does the value go into the page state, or does the browser call `get()` on resume, and what if they differ); a store read inside `$memo`; batching of several store updates into one pass; whether brumate ships its own small `Store` class (as `silmaril/store` does) or only the contract; types for read-only and writable stores; the cost in the client.
- Check docs/decisions.md and proposals.md before proposing syntax.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
