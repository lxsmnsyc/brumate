---
id: brumate-check
title: brumate check, with codes and links for compile errors
status: active
priority: should
type: feature
outline: false
milestone: agent-skill
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/check-command.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/check-command.ts
  - packages/brumate/test/check-command.test.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/cli.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/parser.ts
reserves: []
provides: []
depends_on:
  - on: brm-skill
    kind: contract
    via: error-catalog
---

# brumate check, with codes and links for compile errors

## Goal

`brumate check` runs the compiler and the type checker on the project and prints each problem as JSON, with its file, range, message and a link to the docs. Each compile error gets a code, such as `BRM012`.

## Context

- Compile errors are reported in analyze.ts and parser.ts.
- Source: [A command for agents](../../../../proposals.md#a-command-for-agents)

## Acceptance

- [ ] `brumate check --json` on a project with an error prints it with its code.
- [ ] Each message has a code and a link.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a command, and a code in each error message.
