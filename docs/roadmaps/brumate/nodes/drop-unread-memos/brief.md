---
id: drop-unread-memos
title: Drop memos that no browser code reads
status: todo
priority: could
type: feature
outline: true
milestone: smaller-client
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: batching
    kind: hard
    why: both change how memos compute in the browser
---

# Drop memos that no browser code reads

## Goal

Browser memos stay eager: a source change computes them in the ordered pass. The compiler drops a pure memo, and its compute, from the browser code when no browser code reads it, as Marko 6 drops unread pure values (`pruneBindings` in its translator). First measure how many browser memos in the ui parts and the website are unread, so the node is sized by the waste it removes.

## Context

- The maintainer and the orchestrator compared lazy and eager memos on 2026-10-27, against Marko 6's source. Marko stays eager, runs each value once per pass, and prunes unread pure values at compile time. It still computes a parent value that only a closed branch reads. A lazy browser runtime was ruled out: more code, async loads would start at the first read, and the effect order would loosen.
- A later step, not in the first cut: move a memo that only one branch reads into that branch, so a closed branch skips its compute.
