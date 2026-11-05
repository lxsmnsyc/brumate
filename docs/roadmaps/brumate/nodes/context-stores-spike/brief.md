---
id: context-stores-spike
title: Spike: a store per provider, built far enough to measure and resume
status: todo
priority: must
type: spike
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
  - packages/brumate/test/stores/**
reserves: []
provides: []
depends_on: []
---

# Spike: a store per provider, built far enough to measure and resume

## Goal

Step 1 of the approved context-stores debate (docs/debates/context-stores/debate.md). Build `brumate/store` (`Store` with `get`, `subscribe`, `set`), `$store(ctx)` and a seroval plugin for `Store` just far enough to compile one provider with 42 readers both ways: today's live context, and one store per provider. Nothing merges as a feature; the outcome reports the gates for the maintainer's go or no-go.

## Acceptance (gates)

- [ ] Resume: a handler field in a store's context crosses as a function reference; one store keeps one identity across a streamed `#loading` chunk; a module-level store changed since the server render is repaired on resume; a reader that resumes after a `set` reads the current value.
- [ ] The diamond cases of ordered-updates (nodes/ordered-updates/outcome.md) pass with a provider store derived from props and memos, and a user `store().set` writes through the queued context send.
- [ ] The gzip of the fixture both ways is recorded in the outcome (reported, not a gate).
- [ ] The outcome proposes the exact API and compile shape for store-contract.

## Sizing

M, time-boxed to three days.
