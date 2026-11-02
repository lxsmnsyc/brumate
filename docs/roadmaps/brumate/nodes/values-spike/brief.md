---
id: values-spike
title: Spike: functions for values
status: todo
priority: should
type: experiment
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: true
verify: 
exclusive: [bench]
fulfilled_by: 
gate: true
added: 
hypothesis: docs/debates/client-restructure/debate.md
owns:
  - docs/roadmaps/brumate/nodes/values-spike/**
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: size-baseline
    kind: hard
    why: the step reports its size against the baseline
  - on: differential-render-test
    kind: hard
    why: its divergence count is the simplicity gate (O15)
  - on: drop-unread-memos
    kind: hard
    why: the baseline is taken after the unread-memo path is gone
  - on: no-html-string-fallback
    kind: hard
    why: every browser body is a cloned template before the spike
  - on: settled-memo-merge
    kind: hard
    why: one settled-memo mechanism is the baseline the value functions replace
---

# Spike: functions for values

## Goal

Answer the client-restructure debate (docs/debates/client-restructure/debate.md, step 4): each value that changes gets one function that a browser render calls directly and a later write queues (P10, as Marko 6 does), replacing `g` and `pass`/`queueWrite`/`drain`. Try it on todos and rows and write the numbers, a design and a go or no-go in the outcome.

## Gates (fixed before the run, on `next` after settled-memo-merge)

- Net todos JS gzip before `load`, app modules included, at least 1.0 kB below `next`, from `pnpm bench --only brumate --scenario todos` with nothing else running.
- Brumate's own script time from `profile-rows.mjs` at most 1.2x `next` for rows create and replace, back to back, and the click within 10% (O8).
- The 9 diamond fixtures named in ordered-updates/outcome.md pass through a minimal codegen path (O9).
- A result under 1.0 kB but no larger than `next` is a go only if it lowers the differential-render-test divergence count and the count of browser-only runtime exports, from a baseline commit fixed before the run (O15).

Anything else is a no-go: both render paths stay (P8).

## Context

- direct-update-calls was merged into this node and values-build (P7).
- Time box: three days, about 0.6M tokens.

## Acceptance

- [ ] outcome.md has the gate results with their commands, a design, and a go or no-go.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: time-boxed to three days.
