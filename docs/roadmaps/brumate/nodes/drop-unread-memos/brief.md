---
id: drop-unread-memos
title: Drop memos that no browser code reads
status: todo
priority: should
type: feature
outline: true
milestone: 0.6.0
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
    why: memo reads in the batched update path
  - on: browser-async
    kind: hard
    why: after the 0.5.0 must line (client-restructure debate, step 1)
---

# Drop memos that no browser code reads

## Goal

Step 1 of the client-restructure debate (docs/debates/client-restructure/debate.md): the browser follows the server, so a memo nothing reads does not run in the browser either (the maintainer, Q2), and `$$b.unreadMemo` and `watchUnreadMemos` (#415, #417) go.

Browser memos stay eager: a source change computes them in the ordered pass. The compiler drops a pure memo, and its compute, from the browser code when no browser code reads it, as Marko 6 drops unread pure values (`pruneBindings` in its translator). First measure how many browser memos in the ui parts and the website are unread, so the node is sized by the waste it removes.

## Context

- The maintainer and the orchestrator compared lazy and eager memos on 2026-10-27, against Marko 6's source. Marko stays eager, runs each value once per pass, and prunes unread pure values at compile time. It still computes a parent value that only a closed branch reads. A lazy browser runtime was ruled out: more code, async loads would start at the first read, and the effect order would loosen.
- A later step, not in the first cut: move a memo that only one branch reads into that branch, so a closed branch skips its compute.
