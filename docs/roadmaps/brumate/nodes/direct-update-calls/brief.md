---
id: direct-update-calls
title: Compile the update table into direct calls and a smaller update runtime
status: todo
priority: could
type: feature
outline: true
milestone: backlog
target:
from:
size: XL
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: usage-pruning-spike
    kind: hard
    why: it shows how much of the size gap pruning closes before a redesign
---

# Compile the update table into direct calls and a smaller update runtime

## Goal

Close more of the client size gap with Marko 6 (todos: 15.2 kB gzip against 4.4 kB) by changing how compiled updates run, not what the compiler knows.

brumate already builds the reactive graph at compile time (docs/decisions.md, docs/compiler.md step 3): no subscriptions are recorded at runtime. But the graph ships as data. Each module has a table `g` (scope kind, slot, then the update keys to run with their depth), and the core interprets it: `set` and `trigger` look up the table, `queueWrite`, `pass`, `drain` and `settle` order the updates, and `trigger` checks and loads module and update code on the way. client/updates.ts is the largest file of the core (4.4 kB raw), with client/scopes.ts (2.1 kB) beside it.

Marko 6 emits the same graph as code: setting `todos` is one function that calls the update of `left` and of the list directly, and only the helpers used ship.

## Questions for the refine

- Can a write call its updates directly, in an order the compiler fixes, and keep the ordered-updates guarantees (docs/roadmaps ordered-updates) for writes across components?
- Which `memo` features (async, pending, held errors, `$debounced`, `$bind` setters) can become compiled paths that ship only where used?
- The code-loading checks in `trigger` (`loadModule`, `loadPart('update')`, `childrenReady`) date from lazy loading. Since all of a page's code loads at start (decision of 2026-10), how much of them can go?

## Context

- Found on 2026-10-30 after perf-pass-0.4. Coverage on todos: brumate loads 37.6 kB raw and runs 19.6 kB; Marko loads 9.3 kB and runs 6.0 kB. Pruning (usage-pruning-spike) cannot close the gap alone.
- Large: it touches codegen, the client runtime, resume and the ordered-updates guarantees.

Outline: needs a goal debate (cost against gain, what breaks) before it is refined.
