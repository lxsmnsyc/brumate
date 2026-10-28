---
id: as-sound
title: Rebuild as.ts on the element types of brumate
status: done
priority: should
type: refactor
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by: 
gate: false
added: 2026-10-26
owns:
  - packages/ui/src/as.ts
  - packages/ui/test/props-types.ts
  - docs/roadmaps/brumate/contracts/part-props.md
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: element-types
    kind: contract
    via: element-types
  - on: props-types-main
    kind: hard
    why: as.ts is on main only after #245 merges
---

# Rebuild as.ts on the element types of brumate

## Goal

`AsTarget`, `TargetProps` and `AsProps` read the element types and `Component<P>` of brumate, instead of fields of `HTMLElementTagNameMap` and a hand-made component type, so `as` is sound and its types read plainly.

## Context

- as.ts lower-cases field names to match attributes, and types a component as `((props: never, ...rest: never[]) => unknown) & { brumateId: string }`.
- Source: Request of the user, 2026-10-26: as.ts is unsound and opaque

## Acceptance

- [ ] props-types.ts has cases that the old as.ts accepted wrongly, such as a field that is not an attribute, and they now error.
- [ ] `pnpm --filter @brumate/ui typecheck` passes.
- [ ] part-props is bumped to v2 if the names change.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one module, with the types given.
