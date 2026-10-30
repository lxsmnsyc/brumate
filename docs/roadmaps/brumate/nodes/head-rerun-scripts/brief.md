---
id: head-rerun-scripts
title: A head script can ask to run again after each client navigation
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
  - on: html-attributes-navigation
    kind: hard
    why: it settles which <html> attributes navigation owns; this adds the other half, scripts that set page state
---

# A head script can ask to run again after each client navigation

## Goal

`updateHead` in packages/brumate/src/runtime/navigate.ts keeps a head element whose HTML is unchanged and does not run it again, so a script does not run twice. A script that sets page state on load, such as one that applies a saved theme or reads a preference, then runs only on the first load. Give such a script a way to run again after each client navigation (an attribute such as `data-rerun`, or an event the loader fires after a navigation that the script listens to). Decide which, document it beside client navigation, and test it.

## Context

- Found with html-attributes-navigation (2026-10-30): navigation removed `data-theme`, and the theme script that would put it back was kept without running. That node keeps attributes the browser set; this one covers scripts that must react to each new page.
- Chosen by the maintainer on 2026-10-30 as part of keeping HTML navigation over component-based routing.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
