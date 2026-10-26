---
id: nested-template-imports
title: A component in a template inside a block is imported
status: done
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
fulfilled_by: "#254"
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/test/render/templateNested.brm
  - packages/brumate/test/render/TplDynamic.brm
  - packages/brumate/test/render/templateNested*.brm
shared:
  - .changeset/*.md
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

- [x] The test of reviews/core-gaps.md section 3 fails on main and passes with the fix.
- [x] The packages/brumate suite passes, and the gzip size of the eager core grows by at most 0.1 kB.
- [x] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one condition in the codegen.

## Log

- 2026-10-26: owned paths corrected at review: the reviews of #254 asked for the deep, twice and loop fixtures. The owned paths were also split into a list, which a script of the orchestrator had joined into one line.
