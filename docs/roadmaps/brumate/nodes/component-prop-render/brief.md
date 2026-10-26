---
id: component-prop-render
title: A component in a prop renders in markup that the browser renders
status: active
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "renders in a block that the browser renders later"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/codegen/render.ts
  - packages/brumate/test/render/LateAs.brm
  - packages/brumate/test/render/lateAsPage.brm
  - packages/brumate/test/render/AsLink.brm
  - packages/brumate/test/render/LateEach.brm
  - packages/brumate/test/render/lateEachPage.brm
  - packages/brumate/test/__snapshots__/render/**
  - packages/brumate/test/render/PassAs.brm
  - packages/brumate/test/render/twoLevelAsPage.brm
  - packages/brumate/test/render/lateAsContext.ts
  - packages/brumate/test/render/ContextAs.brm
  - packages/brumate/test/render/contextAsPage.brm
  - packages/brumate/test/render/HydratedEach.brm
  - packages/brumate/test/render/hydratedEachPage.brm
  - packages/brumate/test/render/AsItalic.brm
  - packages/brumate/test/render/swapAsPage.brm
shared:
  - .changeset/*.md
  - packages/brumate/test/resume.test.ts
  - packages/brumate/src/runtime/client.ts
reserves: []
provides: []
depends_on: []
---

# A component in a prop renders in markup that the browser renders

## Goal

In the browser a component value is a stub that renders nothing, so a component in a prop, rendered by `<{as}>` in a block or a `#for` item that the browser renders, is empty. Give `dynamic` and `dynamicNodes` the component's render function: the compiler imports the render modules of components that reach a prop as values, or the core loads them by ID.

## Context

- The cause, the fixtures and the failing test are in [reviews/core-gaps.md](../../reviews/core-gaps.md), section 2. Use them as they are, and see the test fail before the fix.
- Found by as-collections (#252), whose change request was rejected so the core is fixed instead.

## Acceptance

- [ ] The test of reviews/core-gaps.md section 2 fails on main and passes with the fix.
- [ ] The packages/brumate suite passes, and the gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the compiler and the core both change, and the choice of how the render module is found is new.

## Log

- 2026-10-26: owned paths corrected at review: the new #for test of the brief, and the render snapshots that gain a brumateId line. The owned paths were also split into a list, which a script of the orchestrator had joined into one line.
- 2026-10-27: the orchestrator asked for the fixtures of the review probes (two levels, context, hydration, handler), so they are owned too.
