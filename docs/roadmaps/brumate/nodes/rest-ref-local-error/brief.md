---
id: rest-ref-local-error
title: A compile error for a ref in rest props copied into a local value
status: todo
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/check.test.ts -t "rest props copied"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/check/restRefLocal*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/check.test.ts
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: rest-ref-spread
    kind: hard
    why: it defines which spreads forward a ref, and this node rejects the case it leaves out
---

# A compile error for a ref in rest props copied into a local value

## Goal

A component that copies its rest props into a local value and spreads that, `const more = { ...rest, class: 'box' }` then `<button {...more}>`, or does the same through a `$memo`, gets a compile error when the rest can hold a bindable prop such as `ref`. The ref would not reach the element on the first render. The error says to spread the rest directly: `<button {...rest} class="box">`. The maintainer chose an error over support on 2026-10-27.

## Context

- Found in the review of rest-ref-spread (#290): its codegen gate forwards only a spread that reads a `prop` or `props-rest` declaration.
- Decide with the type checker (check.ts, which already checks `$$sendable` and `$$sendableRef`): the error fires when the props type allows a `Bindable` key that is left in the rest. If the props are untyped, do not report. Say in the outcome why, or ask the orchestrator if that rule looks wrong.
- Add a catalog entry in error-catalog.ts with a code and the fix, like other compile errors.

## Acceptance

- [ ] Tests: a rest with a `Bindable` `ref` copied into a const and spread is an error; the same through `$memo` is an error; a direct spread, and a copy of a rest that cannot hold a bindable prop, are not.
- [ ] The packages/ui suite and type check pass, or the outcome lists the parts that hit the error and how they were rewritten.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one check and its catalog entry.
