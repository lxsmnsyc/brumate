---
id: as-live-props
title: Live props reach a component that a page gives to a part in as
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "updates a prop that a part sends to its target"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/src/project.ts
  - packages/brumate/test/render/GapPart.brm
  - packages/brumate/test/render/GapTarget.brm
  - packages/brumate/test/render/gapProps*.brm
shared:
  - .changeset/*.md
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/project.test.ts
  - packages/ui/test/as-collections.test.ts
  - packages/ui/test/as-controls.test.ts
reserves: []
provides: []
depends_on: []
---

# Live props reach a component that a page gives to a part in as

## Goal

A part renders `<{as ?? 'div'} aria-selected=(on)>`, and a page passes `as=Target`. The live props of the dynamic tag reach `Target`. Today the project analysis gives them only to the `.brm` imports that the part itself reads as values, so `Target` keeps the props of the server render.

## Context

- Reproduction and failing test: [reviews/core-gaps-2.md](../../reviews/core-gaps-2.md), section 1. Use them as they are, and see the test fail before the fix.
- This is gap 1 of the component-tag-live-props outcome: a component reached through a parent's prop keeps static props. The analysis in `summarize` and `analyzeProjectProps` (packages/brumate/src/project.ts) must follow a component passed as a prop value to the dynamic tag that reads that prop.
- In packages/ui, the `it.fails` tests "updates the attributes that a part gives to a component in as" and "updates the checked attribute of a menu item with a component in as" (as-collections.test.ts), and the live-attribute test of as-controls.test.ts, show the same gap. Turn each that passes into `it`.

## Acceptance

- [ ] The test of section 1 fails on main and passes with the fix, for both the element and the component fixture.
- [ ] The packages/brumate suite and the packages/ui suite pass. The ui `it.fails` tests of this gap are `it`.
- [ ] The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the project analysis, one more way a component reaches a dynamic tag.
