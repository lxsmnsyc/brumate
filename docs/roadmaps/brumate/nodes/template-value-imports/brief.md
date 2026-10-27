---
id: template-value-imports
title: A template imports a component named only in an attribute value
status: done
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "gapTemplate"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/test/render/gapTemplate*.brm
shared:
  - .changeset/*.md
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/GapPart.brm
  - packages/brumate/test/render/GapTarget.brm
  - packages/ui/test/as-collections.test.ts
  - packages/ui/test/as-controls.test.ts
reserves: []
provides: []
depends_on: []
---

# A template imports a component named only in an attribute value

## Goal

`#template row(label) { <GapPart as=GapTarget>{label}</GapPart> }`, rendered by the browser, throws `ReferenceError: GapTarget is not defined`. The client part of the template imports the components used as tags, but not one named only in an attribute value.

## Context

- Reproduction and failing test: [reviews/core-gaps-2.md](../../reviews/core-gaps-2.md), section 2. Use them as they are, and see the test fail before the fix. Section 1 defines GapPart.brm and GapTarget.brm; as-live-props may add the same files. Write them byte for byte as section 1 shows, so both branches add the same files.
- nested-template-imports (#254) fixed the imports of a template inside a block, in the client codegen. This is the same family: the imports that a template's client part needs.
- In packages/ui, the `it.fails` test "renders a template that names the component, for a folder that opens" (as-collections.test.ts) and the ToastRegion template test of as-controls.test.ts show the same gap. Turn each that passes into `it`.

## Acceptance

- [ ] The test of section 2 fails on main and passes with the fix.
- [ ] The packages/brumate suite and the packages/ui suite pass. The ui `it.fails` tests of this gap are `it`.
- [ ] The gzip size of the eager core does not grow.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the imports that the codegen collects for a template part.
