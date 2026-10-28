---
id: runtime-event-cancel
title: Delegated events can be cancelled when a handler or modifier appears after load
status: todo
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# Delegated events can be cancelled when a handler or modifier appears after load

## Goal

A `prevent` modifier or a handler that cancels an event works when its `b-on` is written after load, and a part can cancel a delegated `submit` or `click` without a window listener of its own.

## Context

- Found by pending-submit (#330) and confirmed by its review. The delegated document listener is marked passive when the markup is scanned at load, from the `b-on` entries found then (boot.ts, about lines 316-329 and 356). A `prevent` that appears later never makes it non-passive, so `preventDefault()` in `apply` (about line 240) does nothing. The document capture `onEvent` also runs before any listener on a form, so a form listener cannot pre-empt a delegated `onSubmit`.
- #330 works around both with a capture `submit` listener on window per submit Button. This node should let that go.
- Shapes to weigh, with their cost: non-passive delegation for `click` and `submit` (never scroll events), re-running `delegate()` when `b-on` is written at run time (inserts.ts about line 406, templates.ts about line 443), or a `cancel()` helper that works in any phase. Measure the todos size and keep it within 0.3 kB.
- In the 0.4.0 cut (the maintainer, 2026-10-29).

## Acceptance

- [ ] A test: a `prevent` added after load cancels the event; a delegated submit can be cancelled by a part.
- [ ] Button drops its window listener from #330 and its tests still pass.
- [ ] The todos size is reported.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the delegation setup and one consumer.
