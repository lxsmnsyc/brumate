---
id: settled-memo-merge
title: "One settled-memo mechanism on feat/browser-async"
status: done
priority: must
type: refactor
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-02
spent: 149000
story: browser-async
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: release-0.4.2
    kind: hard
    why: "#419 and #421 (fillSettled, settledMemos) reach next and feat/browser-async through the 0.4.2 sync"
---

# One settled-memo mechanism on feat/browser-async

## Goal

When `main` (0.4.2) is synced into `feat/browser-async`, the browser render has one way to wait for a memo that settles: #419's `fillSettled`/`settledMemos`, with #421's extension to block headers, props and function reads, rewritten onto `waits.ts` (`settledSlots`, `fillRange`) from browser-await, or the reverse.

## Context

- Step 0 of the client-restructure debate (docs/debates/client-restructure/debate.md, O12, O16, O17). The only step of that debate before 0.5.0.
- Both mechanisms solve the same case: a memo that settles during a browser render is written once, not loaded again.
- Until values-build lands, the browser-async children keep pending and fallback state in scope slots, not new hold-back helpers (P14).

## Acceptance

- [ ] One mechanism remains; the other's runtime exports and codegen are gone.
- [ ] The #419, #421 and browser-await tests pass on `feat/browser-async`.
- [ ] Todos (`pnpm bench --only brumate --scenario todos`) within 0.3 kB of `feat/browser-async` before the merge.

## Sizing

M: about 0.3-0.5M tokens (O16): two mechanisms in codegen and runtime, a full check on the branch.
