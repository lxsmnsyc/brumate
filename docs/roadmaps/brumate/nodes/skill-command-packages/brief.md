---
id: skill-command-packages
title: brumate skill also installs the skills of @brumate packages
status: todo
priority: could
type: feature
outline: true
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: ui-skill
    kind: hard
    why: it ships the first package skill, packages/ui/skills/brumate-ui
---

# brumate skill also installs the skills of @brumate packages

## Goal

`brumate skill [folder]` (packages/brumate/src/cli.ts, about lines 109-120) copies only brumate's own `skills/brumate`. Make it also copy the `skills` folder of every installed `@brumate/*` package that has one (first: @brumate/ui's `brumate-ui`), so one command installs every skill whose version matches the installed packages. Until then the ui docs say to copy it by hand.

## Context

- Found by the review of ui-skill (#378, 2026-10-30).

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
