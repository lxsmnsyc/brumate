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

## How Marko 6 orders updates (read in marko 6.4.6, dist/debug/dom)

- Diamonds inside a scope: a value with several inputs compiles to `_or(id, fn, count)`. Each input that runs lowers a counter, and `fn` runs once the last one arrives, so it never reads a stale input.
- Across scopes: `queueRender` puts a pending render in a binary heap keyed by `scopeId * 1e6 + signalKey`. Scope ids roughly follow creation order, so parents usually run first; the order inside a scope is fixed by the compiler.
- A render stamped with the current `runId` is not queued again. Writes from a handler batch (`schedule()`) and run in one synchronous pass. The debug build still warns: "A render was queued again after it ran in this update, so its latest value is dropped. This is a bug in Marko."
- What Marko leaves out of that path: async values have their own path (`queueAsyncRender`, the `await` tag), `catch` is installed only where used (`installCatch`), two-way props call the parent's change handler (`_let_change`), and all of a page's code is present, so no write waits for code.

brumate's ordered updates (#152) solve the same diamonds by depth (`depthOf`, `holderOf`, `queueWrite`, `drain`). The extra size comes from what the pass also handles: code loading in `trigger`, async memos with pending and latest-load-wins, errors held as values, `$bind` through any number of levels, and passes that wait for code or children (`waiting`, `loadingUpdates`, `settle`). Candidates, cheapest first: drop the code-loading waits if eager loading makes them dead (check navigation, `defer` and child bundles first); make async memos, held errors and `$bind` compiled paths that ship only where used; compile the table into calls with `_or`-style counters for diamonds.

## Context

- Found on 2026-10-30 after perf-pass-0.4. Coverage on todos: brumate loads 37.6 kB raw and runs 19.6 kB; Marko loads 9.3 kB and runs 6.0 kB. Pruning (usage-pruning-spike) cannot close the gap alone.
- Large: it touches codegen, the client runtime, resume and the ordered-updates guarantees.

Outline: needs a goal debate (cost against gain, what breaks) before it is refined.
