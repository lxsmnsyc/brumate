---
id: control-target
title: A typed target for the events of form controls
status: todo
priority: should
type: feature
outline: false
milestone: types
target:
from:
size: S
spike: false
verify: pnpm --filter brumate typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/elements.d.ts
  - packages/brumate/src/check.ts
  - packages/brumate/test/elements-types.ts
  - packages/tsc/test/tsc.test.ts
reserves: []
provides: []
depends_on:
  - on: event-names
    kind: hard
    why: both change the handler helper of the check
  - on: element-values
    kind: hard
    why: both edit the handler type in elements.d.ts
---

# A typed target for the events of form controls

## Goal

As in Solid, `event.target` is the element itself for `input`, `change`, `beforeinput`, `focus`, `blur`, `focusin` and `focusout` on `input`, `select` and `textarea`, and `Element` for other events on elements. `<window>` and `<document>` keep `EventTarget`.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 1, item 11, and section 4 H.
- Today a handler writes `(event.target as HTMLInputElement).value`. Check the casts in packages/ui and the website that this makes unneeded, and remove a few as proof; leave the rest.

## Acceptance

- [ ] A brumate-tsc fixture reads `event.target.value` in an `onInput` of an `input` with no cast, and it fails on main.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one handler type.
