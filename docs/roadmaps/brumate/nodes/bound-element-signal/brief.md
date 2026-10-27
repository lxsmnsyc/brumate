---
id: bound-element-signal
title: A signal bound to a component's ref may hold an element
status: todo
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/src/check.ts
  - packages/brumate/test/check.test.ts
shared:
  - .changeset/*.md
  - packages/ui/test/fixtures/asControls.brm
  - packages/ui/test/fixtures/as-collections.brm
reserves: []
provides: []
depends_on: []
---

# A signal bound to a component's ref may hold an element

## Goal

`let el = $signal<HTMLElement>()` with `<Toolbar ref=$bind(el)>` fails the type check with "A function cannot be sent to the client". The same signal on `<div ref=$bind(el)>` passes. A signal bound to a component prop is checked as page state, but the element of a `ref` binding is never sent: the browser fills it.

## Context

- Reproduction: [reviews/core-gaps-2.md](../../reviews/core-gaps-2.md), section 3. The check is `$$sendable` and `$$Sendable` in packages/brumate/src/check.ts.
- Decide how the check knows the binding holds an element: by the `Bindable<...>` type of the target prop, or by the prop's name `ref`. Prefer the type; say which in the outcome.
- The ui test fixtures type such signals `$signal<any>()` as a workaround. Change them to `$signal<HTMLElement>()`.
- Put a test next to the existing tests of the check (find them with `grep -rl sendable packages/brumate/test`).

## Acceptance

- [ ] A check test with `$signal<HTMLElement>()` bound to a component's `Bindable<HTMLElement | undefined>` prop fails on main and passes with the fix.
- [ ] A function in a bound signal still errors.
- [ ] The ui fixtures use `$signal<HTMLElement>()`, and `pnpm --filter @brumate/ui typecheck` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one rule of the type check.
