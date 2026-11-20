---
id: skill-blocks-typecheck
title: The brumate skill's code blocks are typechecked
status: done
priority: should
type: chore
outline: false
milestone: 0.9.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/skill.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns:
  - packages/brumate/test/skill.test.ts
shared:
  - packages/brumate/skills/brumate/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-skill
    kind: hard
    why: it adds typechecking of the blocks in the ui skill's test; reuse that approach
---

# The brumate skill's code blocks are typechecked

## Goal

packages/brumate/test/skill.test.ts compiles the `brm` blocks of the brumate skill but does not typecheck them, so a wrong prop or a misspelled API passes. Run brumate-tsc on the written blocks as the ui skill's test does (ui-skill, #378), and add a `wrong:` block with a type error that must fail.

## Context

- Found by the review of ui-skill (#378, 2026-10-30).
- Prior art: packages/ui/test/skill.test.ts writes the blocks into a folder under the package, adds a tsconfig that extends the repo's, runs `packages/tsc/bin/brumate-tsc.js --noEmit -p` once for all blocks, and maps each error back to its block. It also counts `typed` blocks, which compile but must fail the type check. Copy that shape.
- brumate does not depend on `@brumate/tsc`; call the bin by its repo path as the ui test does, and do not add a dependency.
- Blocks marked `uses` call a module of the same page (```ts module="name" blocks); write those modules beside the block so imports resolve. `fragment` blocks are not files and stay out of the check.
- Blocks that fail the type check today are bugs in the skill: fix the block in the skill text, unless the error is a brumate-tsc bug, which goes in outcome.md as a new node, not fixed here.

## Acceptance

- [ ] Every whole-file `brm` block of the skill (SKILL.md and references) passes brumate-tsc, in one tsc run per test file.
- [ ] At least one block is marked as a type error (the ui test's form) with a wrong prop or a misspelled API, and the test fails if tsc accepts it.
- [ ] No new dependency of brumate; the written folder is cleaned up or ignored by git.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`, and `pnpm --filter brumate exec vitest run test/skill.test.ts`.

## Sizing

S: one test file, plus fixes to the skill text the check finds.
