---
id: element-checks
title: Check the attributes of plain elements, and type children and templates
status: todo
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: L
spike: false
verify: pnpm --filter @brumate/tsc exec vitest run
exclusive: []
fulfilled_by: 
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/check.ts
  - packages/tsc/test/fixture/src/Elements.brm
shared:
  - packages/tsc/test/tsc.test.ts
  - packages/brumate/test/check.test.ts
  - website/**
  - examples/**
  - packages/ui/src/*.brm
  - packages/ui/test/fixtures/**
reserves: []
provides: []
depends_on:
  - on: element-types
    kind: contract
    via: element-types
  - on: as-controls
    kind: hard
    why: it fixes callers across the parts, which as-controls rewrites
  - on: as-collections
    kind: hard
    why: it fixes callers across the parts, which as-collections rewrites
  - on: ui-generics
    kind: hard
    why: it fixes callers across the parts, which ui-generics rewrites
  - on: as-sound
    kind: hard
    why: the parts take attributes through as.ts, which as-sound rebuilds
---

# Check the attributes of plain elements, and type children and templates

## Goal

The type check checks the attributes of a plain element against its element type, as it checks the props of a component since #241. Children are `Markup`, and a `#template` returns `Markup`, so a prop that takes markup is typed. Fix every caller in the repository that the stricter check reports.

## Context

- check.ts writes `$$use` for most element attributes, and `children: undefined as any` for the children of a component.
- Source: Request of the user, 2026-10-26

## Acceptance

- [ ] The brumate-tsc fixture reports an unknown attribute and a wrong attribute type on a plain element, at the attribute.
- [ ] `pnpm typecheck` exits 0 in every package, the website and the examples.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

L: blast radius high, since every .brm file is checked more strictly, and callers across the repo need fixes.

## Notes for the worker

- Judge each checker by its exit code, and add a deliberate error first to prove it runs.
