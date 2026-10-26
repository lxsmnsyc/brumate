---
id: brm-skill
title: A skill for .brm files, with a test of its code blocks
status: todo
priority: must
type: feature
outline: false
milestone: agent-skill
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
  - packages/brumate/src/error-catalog.ts
  - docs/roadmaps/brumate/contracts/error-catalog.md
shared:
  - packages/brumate/src/cli.ts
reserves: []
provides: [error-catalog]
depends_on: []
---

# A skill for .brm files, with a test of its code blocks

## Goal

Ship a skill in the Agent Skills format in the brumate package: SKILL.md with the rules that agents get wrong, and references for syntax, state, events, the ui parts and errors. `npx brumate skill` copies it. A test compiles every `brm` block of the skill, and a block marked wrong must fail with the error the skill names.

## Context

- The idioms: `{name}`, `{onClick}`, `} #else {`, `prevent(handler, key)`, `ref=$bind(name)`, `let` props with `Bindable<T>` for `$bind`, `#template` for markup as a value.
- errors.md is generated from an error catalog: one entry for each compile error, with its message, its cause and its fix. Freeze the error-catalog contract first, since brumate-check adds a code and a link to each entry.
- Source: [A skill for .brm files](../../../../proposals.md#a-skill-for-brm-files)

## Acceptance

- [ ] `npx brumate skill` copies the skill into .claude/skills/brumate.
- [ ] The test of the code blocks passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: mostly writing, with one test harness.
