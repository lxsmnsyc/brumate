---
id: compiled-graph
title: Build the reactive graph at compile time
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
    kind: soft
    why: it shows how much of the size gap pruning closes before a redesign
---

# Build the reactive graph at compile time

## Goal

Close most of the client size gap with Marko 6 (todos: 15.2 kB gzip against 4.4 kB) by working out which values depend on which at compile time, so that a write calls the updates it needs directly. Today signals, memos and ordered updates are a runtime system: client/updates.ts is the largest file of the core (4.4 kB raw), with client/scopes.ts (2.1 kB) beside it.

## Context

- Found on 2026-10-30 after perf-pass-0.4. Even the code that runs on todos (19.6 kB raw) is twice Marko's whole bundle (9.3 kB), so pruning (usage-pruning-spike) cannot close the gap alone.
- Marko 6 output for todos: setting `todos` is one function that updates `left` and the list; there is no dependency tracking at runtime. Handlers resume by id, and the server writes the scope objects.
- Large: it touches the compiler, the client runtime, resume and the ordered-updates guarantees.

Outline: needs a goal debate (cost against gain, what breaks in `$memo`, `$effect`, stores and components) before it is refined.
