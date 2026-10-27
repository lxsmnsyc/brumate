---
id: as-passed-on
title: Live props reach a component that one part passes on to another in as
status: active
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "passes on"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/gapPassOn*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/project.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/project.test.ts
  - packages/ui/test/as-controls.test.ts
reserves: []
provides: []
depends_on:
  - on: as-live-props
    kind: hard
    why: it extends the analysis that as-live-props adds
---

# Live props reach a component that one part passes on to another in as

## Goal

ToggleButton takes `as` and passes it on to Button as `{as}`. A page gives `<ToggleButton as=Target>`, and Button's live props do not reach `Target`. as-live-props (#278) follows only a component that a page names in `as=`. Follow it through a prop that a part passes on, and through `as=(cond ? A : B)`.

## Context

- Found by the review of #278. The ToggleButton test in packages/ui/test/as-controls.test.ts stays `it.fails` for this; turn it into `it`.
- Keep the analysis narrow: the review of #278 compared `analyzeProjectProps` on all of packages/ui before and after, and only the `as` target gained props. Do the same comparison and report it.

## Acceptance

- [ ] A packages/brumate test with a part that passes `as` on to another part, and one with `as=(cond ? A : B)`, fails on main and passes with the fix.
- [ ] The packages/brumate and packages/ui suites pass. The ToggleButton test is `it`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two more paths in the project analysis.
