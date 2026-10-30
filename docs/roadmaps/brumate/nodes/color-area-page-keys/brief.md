---
id: color-area-page-keys
title: ColorArea keeps the other channel when PageDown moves the focused one
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: node e2e/run.mjs --only ui
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/**
  - packages/ui/test/**
reserves: []
provides: []
depends_on: []
---

# ColorArea keeps the other channel when PageDown moves the focused one

## Goal

Found on main by the review of #370 (2026-10-30), confirmed on a clean main worktree. The e2e step "ColorArea: the keys, a press on the area, and a drag from the thumb" (e2e/suites/ui.mjs, about line 1565) fails: after ArrowRight, then ArrowUp on the x input (the focus moves to the y input), PageDown should give `hsb(210, 51%, 71%)` and gives `hsb(210, 0%, 71%)`. The saturation (x) is lost when the y input changes. Recent ColorArea commits: 469de29b, c6c7c914, a9a3c875 (kept values and synchronous onChange); check whether one of them caused it.

A main bug: branch from main, its own PR.

## Acceptance

- [ ] A ui unit test reproduces the lost channel and fails on main (happy-dom), or, if it cannot, the e2e step is the proof and the log says why.
- [ ] The e2e ColorArea step passes (`node e2e/run.mjs --only ui`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one part, one test.
