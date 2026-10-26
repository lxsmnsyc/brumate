---
id: props-types-main
title: Props types and typed as on main
status: done
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by: "#245"
gate: false
added: 
owns:
  - packages/ui/src/as.ts
  - packages/ui/test/props-types.ts
shared: []
reserves: []
provides: [part-props]
depends_on: []
---

# Props types and typed as on main

## Goal

Merge #245, which brings #242 to main. Every part exports `<Name>Props` from `<script module>`, and the parts with `as` take an element name or a component, with the props of the target.

## Context

- #242 merged into its base branch, not main. #245 is the same commit rebased onto main, with the conflicts of #238 resolved.
- Source: PR #245

## Acceptance

- [ ] #245 is merged into main.
- [ ] `pnpm typecheck` passes, including packages/ui/test/props-types.ts.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the work is done. Only the review and the merge remain.
