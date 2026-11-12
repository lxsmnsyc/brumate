---
id: children-rerender
title: A spread onto a component does not render its children again
status: todo
priority: must
type: fix
story:
early: false
outline: true
milestone: 0.8.1
target: main
ship: auto
land: auto
from: 
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# A spread onto a component does not render its children again

## Goal

A `{...rest}` spread onto a component makes every prop of that component live for the whole project, `children` too. After resume, a template body sends its props again on the first change, and the child renders its children fresh, so nodes and focus are replaced. Children that did not change stay.

## Context

- Found on 2026-10-26 while building NavigationTree (#172). The parts work around it with a context (`TreeItemAttributesContext`). spread-children-live (0.4.0) and later fixes may have closed it.
- First prove it on `main` with a failing test: a Tree row template, a spread onto the item part, and a count of the child's renders. If it no longer fails, close the node with that test and remove the workaround only if the test covers it.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
