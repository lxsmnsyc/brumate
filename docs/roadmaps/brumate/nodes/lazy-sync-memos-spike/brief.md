---
id: lazy-sync-memos-spike
title: "Spike: lazy sync memos in the browser"
status: todo
priority: could
type: spike
outline: false
milestone: backlog
target:
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-12
owns:
  - docs/roadmaps/brumate/nodes/lazy-sync-memos-spike/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Spike: lazy sync memos in the browser

## Goal

Find out whether browser memos with sync computes should compute when they are read instead of when an input changes, and what that costs. Async memos stay eager. Write the design and the numbers in the outcome so the maintainer can decide. No code merges from this node.

## Current state

- The server is lazy. `memo()` stores the compute, and `read()` runs it on first read (`packages/brumate/src/runtime/server.ts`, `memo` and `read`). `docs/decisions.md` line 26 says so.
- The browser is eager. A write queues the memos that read it, and `drain` runs them by rank (`packages/brumate/src/runtime/client/updates.ts`, `queue`, `drain`, `settle`). The compiler leaves out memos that nothing reads (node drop-unread-memos). A memo that only a closed branch, a hidden `#offscreen` body or a handler reads still computes on every write. That node's outcome lists this as a stub.
- `get` already pulls in one case. While a pass is pending, a read calls `settle(scope)`, which computes the queued memos of that scope.

## Proposed design (to test)

1. Async memos stay eager, because the time a load starts matters. A memo is async when the compiler marks it `async-memo` (`analyze.ts`: it calls a server function, reads a `'use server'` import, or awaits).
2. Every other memo starts lazy. A write marks it stale, and a read computes it.
3. Some memos have kind `memo` but return a promise, for example from an imported helper or a function prop. `memo()` already sees the thenable or async iterable before `asyncMemo`. At that point the slot gets a sticky flag, and the memo is eager from then on. The cost of a wrong guess is one late load start, never a wrong value.
4. On resume, a memo whose value streamed (`loadingValues`) or that holds a promise starts with the flag set.
5. A sync memo that reads an async memo stays lazy. The load belongs to the upstream memo, and `upstreamMemos` already makes the downstream memo pending.

## Questions

1. Count first. In packages/ui, website and the examples, how many browser memos does only a branch, a hidden body, a handler or `$resolve` read? Use `analyze` and `buildGraph`, as drop-unread-memos counted 0 of 351 unread. Also count how many memos are `memo` but return a promise at run time in the e2e suites. If both counts are near zero, stop and recommend keeping eager.
2. Cut-off. Today a recompute that gives the same value skips `set`, so the readers do not run. A lazy memo cannot know this before its readers are queued. Which works best here: a check state on bindings that read memos (Reactively or Solid 2.0 style coloring), or pulling the memo before the binding runs? What does it cost in bytes and in time per write?
3. What changes for `$isPending`, `#loading (m)` headers, `$resolve`, BRM182, `$gate`, guesses (`$optimistic`), `memoSignal` aborts and held errors (`MemoError`)? Each has to pull a stale memo to answer.
4. Order. Can the memo rank buckets in `drain` go, with reads giving the order? Does the ordered-updates guarantee (no reader sees a new signal with an old memo) still hold?
5. Numbers: gzip size of the todos page and the runtime, and `pnpm bench --only brumate --scenario todos` script time, against main. Also count the differential-test divergences before and after (`packages/brumate/test/differential*`).

## Context

- The eager-server alternative was weighed and not picked. It wastes server function calls for memos read only in a closed branch or in a `#defer` body, which renders in its own request. A narrower follow-up is open: the compiler starts early only the async memos that the server will read for sure.
- The client-restructure debate set the direction that the browser follows the server (`docs/debates/client-restructure/debate.md`). Its values-spike missed its size gates, so size is a gate here too: a gain in compute work does not justify a larger client by default.
- Read `docs/decisions.md` (memos, `$gate`, ordered updates, client restructure) before you propose changes to its rules. Rule changes need the maintainer's approval.

## Acceptance

- [ ] outcome.md answers the five questions and recommends one of three options: build the hybrid, build part of it, or keep eager.
- [ ] Either a prototype on a branch (not merged) with the numbers for question 5, or the counts from question 1 showing that none is needed.

## Sizing

M: counts, a design and a prototype of the client memo path, with no merged code.
