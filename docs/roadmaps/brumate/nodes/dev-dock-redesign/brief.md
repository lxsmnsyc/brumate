---
id: dev-dock-redesign
title: Redesign of the dev dock
status: todo
priority: should
type: feature
outline: true
milestone: 0.7.0
target:
from:
size: L
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: true
added: 2026-11-03
owns:
  - packages/brumate/src/runtime/devtools-panel.ts
shared:
  - .changeset/*.md
  - website/docs/inspect.md
reserves: []
provides: []
depends_on: []
---

# Redesign of the dev dock

## Goal

A new design for the devtools dock of the dev server: the grip at the bottom edge of the page, the tab it grows into, and the panel with its tabs (Overview, Errors, Components, Elements, Graph, Log, Blocks, Report).

## Context

- Asked by the maintainer on 2026-11-03.
- The dock lives in `packages/brumate/src/runtime/devtools-panel.ts` (about 3,100 lines) and is described in `website/docs/inspect.md`.
- Gate: a prototype goes to the maintainer first. After approval, the port matches the prototype exactly and drops parts of the old panel that are not in it.
- devtools-copy adds buttons to the same panel, so it waits for this node.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it: first write down what the redesign changes (layout, tabs, look) with the maintainer, then split the prototype from the port.
