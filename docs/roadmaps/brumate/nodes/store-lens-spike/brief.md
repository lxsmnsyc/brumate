---
id: store-lens-spike
title: "Spike: $store and lens utilities"
status: todo
priority: could
type: spike
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-27
owns:
  - docs/roadmaps/brumate/nodes/store-lens-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: batching
    kind: hard
    why: a store write that touches several paths must be one pass, which batching defines
---

# Spike: $store and lens utilities

## Goal

Find out whether brumate can have a `$store` with reads per path, and lens utilities that focus on a part of a signal or a store, and what they would cost. Write a design and the numbers in the outcome, so the maintainer can decide. No code merges from this node.

## Questions

1. `$store`: a value whose nested reads are tracked per path, written in place (`todo.done = true`) or through `$produce`. Can the compiler find the paths statically, as it finds reads of signals today? What breaks: the static graph, the page state (how a store resumes), `#for` items, `$bind`, and the warning for changes in place?
2. Lens: a focused getter and setter on a path of a signal or store, for example `const done = $lens(todos, (t) => t[i].done)`, usable with `$bind(done)` and as a prop that a child writes. Can it be compile time only, like `$memo`, so nothing new ships to the browser? How does a write through a lens become one `$produce` of the source?
3. How Solid (`createStore`, `produce`, `reconcile`), Marko 6 and Svelte 5 (`$state` proxies) do it, and which parts fit a compiled, resumable framework.
4. Cost: bytes in the eager core and per page, and the update cost on the rows and todos benchmarks, against main with `$produce`.

## Context

- docs/decisions.md says: "There is no `$store`. Objects and arrays in signals change by assigning a new value, or with `$produce` ... Reads stay per signal, so the graph stays static and nothing extra is resumed." This spike re-evaluates that decision at the maintainer's request (2026-10-27). If the answer is yes, the decision changes only with the maintainer's approval.
- Props rule (2026-10-27): props are destructured, spread in markup or read by key. A lens on props must fit that rule.
- Check docs/decisions.md and proposals.md before proposing syntax; `#` blocks are only for markup.

## Acceptance

- [ ] outcome.md answers the four questions with a recommendation: build, build a part (for example lenses only), or keep the decision.
- [ ] A prototype on a branch (not merged), or a written reason why none was needed, with numbers for question 4.

## Sizing

M: a design and a prototype, no merged code.
