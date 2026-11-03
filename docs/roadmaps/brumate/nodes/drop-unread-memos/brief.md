---
id: drop-unread-memos
title: Drop memos that no browser code reads
status: done
priority: must
type: feature
outline: false
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
spent: 241000
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/src/graph.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/**
  - website/docs/reactive-graph.md
  - website/docs/what-runs-where.md
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

Step 1 of the client-restructure debate (docs/debates/client-restructure/debate.md): the browser follows the server, so a memo that nothing reads does not run in the browser either (the maintainer, Q2). The server already computes a memo only when something reads it (docs/decisions.md:26). The browser still runs the compute of a memo that has no slot, and `$$b.unreadMemo` (runtime/client/updates.ts) with `watchUnreadMemos` (codegen/markup.ts) exist only to report the rejection of such a memo (#415, #417). After this node, the compiler drops the declaration and its compute from the browser code, and both helpers go.

Browser memos stay eager otherwise: a source change computes the memos that are read in the ordered pass, as today. This is compile-time pruning, as Marko 6 drops unread pure values (`pruneBindings` in its translator), not a lazy runtime.

## Context

- Measure first: count the browser memos with no read in packages/ui, website and the examples, and write the number in the outcome, so the node is sized by the waste it removes.
- Which memos count as unread: no read at all in any browser code (markup, handlers, effects, `$client`, other memos, props passed on, `$isPending`, `#loading (m)` headers, `$resolve`). A memo read only by `await m` is read: the server waits there and throws its error at the `await`. Check what browser-await (on `next` since 0.5.0) does with such a read before you decide whether `unreadMemo` is still needed for it; if it is, keep that one case and say so in the outcome.
- A memo whose compute has side effects (a server function call, a write) also stops running in the browser. That matches the server, which never runs it either. Say it in the docs that explain what runs where.
- The differential test (packages/brumate/test/differential*) lists known divergences between the server and browser renders. If this change fixes one, remove its entry, and give the new count in the outcome.
- Until values-build lands, keep pending state in scope slots (docs/decisions.md, the client restructure entry).
- A later step, not in this node: move a memo that only one branch reads into that branch, so a closed branch skips its compute.

## Acceptance

- [ ] A browser memo that nothing reads has no compute and no declaration in the client output (a test on the compiled code), and does not run in a browser render (a test with a side effect in its compute).
- [ ] `unreadMemo` and `watchUnreadMemos` are gone, or only the `await`-only case keeps a reporter, with the reason in the outcome.
- [ ] The tests of #415 and #417 (the rejection of an unread or await-only memo) still pass, or are rewritten to the new rule with the reason.
- [ ] The count of unread browser memos found, and todos gzip JS before `load` (no growth; a drop is the goal).
- [ ] A patch changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one pruning rule in the compiler, the removal of two helpers, and their tests.
