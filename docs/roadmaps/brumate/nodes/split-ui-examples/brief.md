---
id: split-ui-examples
title: One file for each part in the ui example page and its e2e suite
status: todo
priority: could
type: refactor
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: node e2e/run.mjs --only ui
exclusive: []
fulfilled_by: 
gate: true
added: 
owns:
  - examples/ui/src/**
  - e2e/suites/ui.mjs
  - e2e/suites/ui/**
shared: []
reserves: []
provides: []
depends_on: []
---

# One file for each part in the ui example page and its e2e suite

## Goal

Split examples/ui/src/routes/index.brm (1,300 lines) and e2e/suites/ui.mjs (1,910 lines) into one module for each part, with a list that registers them. Every new part then adds its own files and one line, so parallel nodes do not edit the same two files. The behavior does not change.

## Context

- Both files change in every pull request that adds a part, so they conflict between parallel branches.
- Keep the order of the sections and of the e2e steps as it is now.
- Source: Split hot files by feature first, from the parallel-roadmap skill

## Acceptance

- [ ] Each part has its own section component in examples/ui and its own e2e step module.
- [ ] The ui e2e suite runs the same steps in the same order: `node e2e/run.mjs --only ui`.
- [ ] No other change goes into this pull request.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a large move with no change of behavior. Gated, since it changes the layout of the code, which the user decides.

## Notes for the worker

- Ask nothing of the parts. Move code only.
