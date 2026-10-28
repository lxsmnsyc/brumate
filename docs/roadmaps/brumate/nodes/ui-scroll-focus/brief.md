---
id: ui-scroll-focus
title: Scrollable regions of the ui docs pages take focus
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/**
  - website/ui/**
  - website/src/**
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on: []
---

# Scrollable regions of the ui docs pages take focus

## Goal

The website e2e flow "/ui: each page of the sidebar loads, with no accessibility violations" passes. Today axe reports `scrollable-region-focusable` on /ui/calendar, /ui/list-box, /ui/grid-list and /ui/tree: a region scrolls, but a keyboard user cannot reach it.

## Context

- Found on 2026-10-28 while running e2e for ui-landing (#316); it fails the same way on main (09e06b30). CI does not run e2e.
- First find which element scrolls: a part (ListBox, GridList, Tree, Calendar's grid) or the demo's wrapper or style on the website. If it is a part, the fix belongs in packages/ui (a collection is usually focusable itself, or its focused item scrolls into view), with a changeset. If it is the demo, fix the demo or its CSS.
- A collection that keeps focus on one item (a roving tabindex) passes axe when the region holds a focusable element; check why axe still reports it, for example an empty list or focus on a child that is not inside the scrolling box.
- Run e2e as try-sample-console's brief says (`--no-build` after a manual build).

## Acceptance

- [ ] The flow passes with no `scrollable-region-focusable` violation, and the parts' ui suites pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a focus or overflow fix in four places that likely share one cause.
