---
id: flaky-resume-reads
title: "Two resume tests stop failing in CI: a pending handler read and a textarea value"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.5.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# Two resume tests stop failing in CI: a pending handler read and a textarea value

## Goal

Two tests of packages/brumate/test/resume.test.ts fail in CI about once in three runs and pass on a rerun. Find whether each is a race in the test or a bug in the runtime, and fix it, so CI is green without reruns.

- "reads a memo created in the browser as pending until its first load lands" (line ~903): saw `['handler', 'Ada']` where it waits for `['handler', 'pending']`. Since blocks hold their new body until it settles (browser-async), the load can land before `.read` shows, so the handler may never see the pending state.
- "shows a pending memo of a promise prop as empty text in a textarea" (line ~630): the textarea was empty where `'Ada'` was expected. The test reads the value once after `waitFor` finds the element, so it is either a test race or a late value write in the runtime.

## Context

- Failures seen in CI on #434 (Node 22 and 24), #440 (Node 22) and #442 (Node 24), 2026-11-03; listed in docs/roadmaps/brumate/inbox.md. They pass locally on a quiet machine.
- The tests exist on `main`, so the fix branches from `main` and reaches `next` through the 0.5.1 sync. If the textarea case is a runtime bug, it ships in 0.5.1 with a patch changeset; a test-only fix needs no changeset.
- Reproduce before fixing: run each test in a loop under load (for example with `--sequence.concurrent` or a CPU hog beside it) until it fails, and record the failure rate before and after.

## Acceptance

- [ ] Each failure is explained in the outcome: test race or runtime bug, with the evidence.
- [ ] A runtime bug gets a fix, a test that fails before it, and a patch changeset.
- [ ] Both tests pass 50 runs in a row under load (the method in the outcome).
- [ ] Todos within 0.3 kB if the runtime changes.

## Sizing

S: two tests and maybe one runtime write.
