---
id: store-any-source
title: $store takes any expression that gives a store
status: done
priority: must
type: feature
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: L
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
  - packages/brumate/skills/**
  - website/docs/context.md
  - website/docs/reference-signals.md
  - website/docs/errors.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: context-docs
    kind: hard
    why: it edits the same docs and decisions.md entry
---

# $store takes any expression that gives a store

## Goal

The maintainer's rule (2026-11-05): `$store` follows its prior art, which all take any store value. The store-contract node narrowed the source to a context, a key of a `$getContext` value or an imported store (everything else BRM194, decisions.md:40), because resume runs no component code. The maintainer never approved that limit. Lift it.

Prior art, to follow and not narrow:

- silmaril ([README, "`$store`"](https://github.com/lxsmnsyc/silmaril#store)): `$store(store)` binds any value with `subscribe(callback): cleanup`, `get()` and optional `set(state)`; `const` is one-way, `let` is two-way.
- Svelte: `$name` subscribes to any store variable declared at the top level of a component (a local `writable`, a prop, an import), and unsubscribes when the component is destroyed.
- React `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`: any external source; the server render and hydration use `getServerSnapshot`, then the client subscribes and re-reads.

Brumate rules to keep: the source runs once and is not tracked; `const` one-way, `let` writes through `set` at the assignment; a store without `set` under `let` throws at registration; a foreign store inside a provided context value is still refused on the server.

Design to settle in the node (write it in the outcome, and in decisions.md:40 replacing the three-source sentence):

- Allowed sources: any expression at the top level of the component script, including `undefined` (`$store(given?.state)` gives `undefined` and subscribes to nothing), a local `store(...)`, a prop, a call result, a `<script module>` variable and a bare namespace import. Remove BRM194 or keep it only for what still cannot work, with the reason.
- Resume, as React's server snapshot: the server sends the value the reader rendered (the slot already holds it). The browser keeps that value until it can subscribe, then subscribes and repairs the slot when `get()` differs, as the import form does today. For a source that is not a context, a key of one or an import, the browser must run the reader's store expression once to get the store: compile it to a client export of the reader (like a memo's code) that reads the resumed values it needs, and run it at resume when the reader's code loads. Say what it costs on the todos page and the ui example.
- A local store made by the expression (`$store(store(0))`) starts from its initial value in the browser; the slot keeps the server value until the first change. Document that and test it.

## Acceptance

- [ ] `$store(x)` works for a local store, a prop holding a store, `undefined` (`$store(g?.key)`), a call result, a `<script module>` store and a namespace import, on the server, in a browser render and on resume, with tests for each (`const` and `let`).
- [ ] Resume never calls `set`; a store whose browser value differs from the server's repairs the slot once.
- [ ] brumate-tsc types `$store(g?.key)` as `T | undefined` with no error under strict.
- [ ] decisions.md:40, website/docs/context.md, reference-signals.md and the brm skill describe the new rule; BRM194's docs match what is left.
- [ ] Todos client JS and the ui example's client JS before and after.
- [ ] A minor changeset.

## Sizing

L: compiler analysis, a new client export for store expressions, resume, types, docs.
