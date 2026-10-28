---
id: tsc-check-api
title: brumate check runs the type checker in process
status: todo
priority: should
type: refactor
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/check-command.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/tsc/src/**
  - packages/tsc/test/**
  - packages/brumate/src/check-command.ts
  - packages/brumate/test/check-command.test.ts
reserves: []
provides: []
depends_on:
  - on: brumate-check
    kind: hard
    why: it replaces the spawn and the text parsing that brumate-check added
---

# brumate check runs the type checker in process

## Goal

`brumate check` gets type errors from a function of `@brumate/tsc` that returns diagnostics, instead of spawning the `brumate-tsc` bin and parsing its text output.

## Context

- Found in the review of brumate-check (#318). `check-command.ts` spawns the bin, parses `file(line,col): error TSnnnn:` lines (`parseTypeOutput`), and turns a failed, killed or overflowing spawn into an error record.
- packages/tsc `run()` hands the whole run to tsc, which prints and calls `process.exit`. The worker judged a function that returns diagnostics to be well over 100 lines, which is why it is its own node.
- Keep the JSON shape of `brumate check --json` as it is. TypeScript records gain real end positions if the API gives them.
- brumate does not depend on `@brumate/tsc`. Keep it optional: load it from the project when present, skip with a note when not.

## Acceptance

- [ ] packages/tsc exports a function that checks a project and returns diagnostics with file, range, message and code, without printing or exiting.
- [ ] `brumate check` uses it; the spawn and `parseTypeOutput` are gone, and its tests pass.
- [ ] `brumate-tsc` output is unchanged.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a function in packages/tsc and its use in one command.
