---
id: event-names
title: Handlers read ElementEvents, and an unknown event is an error
status: todo
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/tsc exec vitest run
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/tsc/test/fixture/src/Events.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/brumate/test/check.test.ts
  - packages/tsc/test/tsc.test.ts
  - packages/ui/src/*.brm
  - website/**
  - examples/**
reserves: []
provides: []
depends_on: []
---

# Handlers read ElementEvents, and an unknown event is an error

## Goal

A handler in markup, such as `onClick=((event) => ...)`, gets its event type from `ElementEvents` of `brumate/elements`, so custom events that an app merges into it reach the handler. An event name that no element fires, such as `onDoubleClick` or `onFooBar`, is a type error at the attribute instead of a silent `Event`.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 1, items 5 and 6, and section 4 A. The cause is the `$$on` and `$$Event` helpers in packages/brumate/src/check.ts (about lines 56-60), which read `HTMLElementEventMap` and fall back to `Event`.
- The element-types contract promises that custom events merged into `ElementEvents` reach handlers.
- `<window>` and `<document>` handlers keep their own maps.
- Run `brumate-tsc --noEmit` on packages/ui, the website and the examples: an unknown event there becomes an error; fix each caller.
- element-checks owns check.ts and runs later; keep this change to the helpers.

## Acceptance

- [ ] A brumate-tsc fixture shows `onFooBar` as an error at its attribute, and a custom event merged into `ElementEvents` typed in its handler. Both fail on main.
- [ ] `pnpm typecheck` exits 0 in every package, the website and the examples.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two helpers of the check, and the callers they flag.
