---
id: brm-skill
title: A skill for .brm files, with a test of its code blocks
status: todo
priority: should
type: feature
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/skill.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/brumate/skills/brumate/**
  - .claude/skills/brumate
  - packages/brumate/test/skill.test.ts
  - packages/brumate/src/cli.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# A skill for .brm files, with a test of its code blocks

## Goal

Ship a skill in the Agent Skills format in the brumate package: SKILL.md with the rules that agents get wrong, and references for syntax, state, events, the ui parts and errors. `npx brumate skill` copies it. A test compiles every `brm` block of the skill, and a block marked wrong must fail with the error the skill names.

## Context

- The idioms are in the memory note brm-idioms: `{name}`, `{onClick}`, `} #else {`, `prevent`, `ref=$bind`, `let` props for `$bind`.
- Source: [A skill for .brm files](../../../../proposals.md#a-skill-for-brm-files)

## Acceptance

- [ ] `npx brumate skill` copies the skill into .claude/skills/brumate.
- [ ] The test of the code blocks passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: mostly writing, with one test harness.
