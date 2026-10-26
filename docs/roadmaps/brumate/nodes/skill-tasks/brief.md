---
id: skill-tasks
title: Tasks that check what an agent writes with the skill
status: todo
priority: should
type: chore
outline: false
milestone: agent-skill
target:
from:
size: S
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/brumate/skills/tasks/**
  - packages/brumate/skills/run-tasks.mjs
shared: []
reserves: []
provides: []
depends_on:
  - on: brm-skill
    kind: hard
    why: the tasks run an agent with the skill
  - on: brumate-check
    kind: hard
    why: each task is graded with `brumate check --json`, then its test
---

# Tasks that check what an agent writes with the skill

## Goal

A small set of tasks, such as a counter, a keyed list, a form with a server function and a Select, that an agent does with the skill. Each must compile, pass `brumate check`, and pass its test. It runs by hand before a release, not in CI.

## Context

- Source: [A skill for .brm files](../../../../proposals.md#a-skill-for-brm-files)

## Acceptance

- [ ] `node packages/brumate/skills/run-tasks.mjs` grades a finished task and reports each check.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: four tasks and a grader.
