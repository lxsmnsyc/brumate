---
id: text-field-refused-edit
title: TextField and SearchField show the kept text after a refused edit
status: todo
priority: should
type: fix
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
  - on: bind-read-your-writes
    kind: hard
    why: it makes a loaded setter run at once and leaves this exception documented
---

# TextField and SearchField show the kept text after a refused edit

## Goal

Every part re-shows the kept value when a bound setter refuses a write, except TextField and SearchField: their native input keeps the typed text (documented in website/ui/state.md since bind-read-your-writes, #372). Writing the kept text back at once would drop the user's typing when a setter accepts later, such as after an async check. Design it so both hold: for example restore only once the setter's call has settled and refused, and keep the caret and selection.

## Context

- The maintainer kept the exception for 0.4.0 on 2026-10-30 and asked for a 0.5.0 node.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
