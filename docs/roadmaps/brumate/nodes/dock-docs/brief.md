---
id: dock-docs
title: Docs and changeset for the new dock
status: todo
priority:
type: feature
story: dev-dock-redesign
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - website/docs/inspect.md
  - .changeset/*.md
shared: []
reserves: []
provides: []
depends_on:
  - on: dock-shell
    kind: hard
    why: the page describes the finished dock

  - on: dock-inspect
    kind: hard
    why: same

  - on: dock-graph
    kind: hard
    why: same

  - on: dock-activity
    kind: hard
    why: same

  - on: dock-call-detail
    kind: hard
    why: same

  - on: dock-issues
    kind: hard
    why: same

  - on: dock-page
    kind: hard
    why: same

  - on: dock-split-handle
    kind: hard
    why: same

  - on: dock-canvas-outlines
    kind: hard
    why: same
---

# Docs and changeset for the new dock

## Goal

Update `website/docs/inspect.md` for the redesigned dock and add the changeset of the story.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] `inspect.md` describes the four workspaces, the dock sides, resizing, the graph, server call details (dev only) and the canvas outlines. No tab that no longer exists is named.
- [ ] One changeset for `brumate` (minor: the dock is new behavior), written to the changesets skill and the plain-writing rules.
- [ ] The website builds: `pnpm --filter website build` passes.

## Sizing

S: see the owned files above.

## Notes for the worker

- Take the numbers and names from the built dock, not from the prototype.
- A docs-only change skips CI (see #357), so run the website build locally.
