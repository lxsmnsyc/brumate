---
id: nested-template-imports
title: A component in a template inside a block is imported
status: todo
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "template that sits inside a block"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/codegen/client.ts packages/brumate/test/render/templateNested.brm packages/brumate/test/render/TplDynamic.brm
shared:
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on: []
---

# A component in a template inside a block is imported

## Goal

A component used as a tag in a `#template` declared inside a block is not imported in the client code, which throws a ReferenceError. `inside()` of the client codegen skips a template that sits within its block.

## Context

- The cause, the fixtures and the failing test are in [reviews/core-gaps.md](../../reviews/core-gaps.md), section 3. Use them as they are, and see the test fail before the fix.
- Found by as-collections (#252), whose change request was rejected so the core is fixed instead.

## Acceptance

- [ ] The test of reviews/core-gaps.md section 3 fails on main and passes with the fix.
- [ ] The packages/brumate suite passes, and the gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one condition in the codegen.
