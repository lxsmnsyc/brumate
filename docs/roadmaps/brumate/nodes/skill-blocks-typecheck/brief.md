---
id: skill-blocks-typecheck
title: The brumate skill's code blocks are typechecked
status: todo
priority: could
type: chore
outline: true
milestone: 0.6.0
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
    why: it adds typechecking of the blocks in the ui skill's test; reuse that approach
---

# The brumate skill's code blocks are typechecked

## Goal

packages/brumate/test/skill.test.ts compiles the `brm` blocks of the brumate skill but does not typecheck them, so a wrong prop or a misspelled API passes. Run brumate-tsc on the written blocks as the ui skill's test does (ui-skill, #378), and add a `wrong:` block with a type error that must fail.

## Context

- Found by the review of ui-skill (#378, 2026-10-30).

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
