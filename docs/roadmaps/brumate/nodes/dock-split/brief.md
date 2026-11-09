---
id: dock-split
title: Split the dock panel into one module per workspace
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
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/runtime/devtools-panel.ts
  - packages/brumate/src/runtime/devtools-panel/**
  - docs/roadmaps/brumate/contracts/dock-workspace-api.md
shared: []
reserves: []
provides: [dock-workspace-api]
depends_on: []
---

# Split the dock panel into one module per workspace

## Goal

Move `devtools-panel.ts` into a folder of modules, one per workspace of the new dock plus shared helpers, with no change in behavior. `devtools-panel.ts` stays as the entry and re-exports what callers and tests import (`openPanel`, `togglePanel`, `layoutGraph`). Freeze the contract that every workspace module follows.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] `devtools.test.ts` and the rest of the brumate tests pass unchanged.
- [ ] Modules: `style.ts`, `dom.ts` (element, svg, icons, pill, row, card), `format.ts` (ms, seconds, kilobytes, readType, measureSize), `stack.ts` (frames, source fetch, highlighter), `graph.ts` (layoutGraph and its drawing), `inspect.ts` (Components, Elements), `activity.ts` (Log, Timeline, Effects, Navigation, Server), `issues.ts` (Errors), `page.ts` (Overview, Page state, Blocks; Report moves here too and dock-page removes it). Each workspace module exports one object that matches the contract.
- [ ] The old tab bar still works and shows the same content as before. Only code moved: no renamed behavior, no new feature.
- [ ] `contracts/dock-workspace-api.md` is frozen with the workspace type, the context a workspace gets, and a `split()` helper stub that returns a plain two-column box.

## Sizing

M: see the owned files above.

## Notes for the worker

- Cross-cutting move of about 3,100 lines; the tab-to-workspace grouping follows the story brief (Inspect = Components + Elements + Graph; Activity = Log + Timeline + Effects + Navigation + Server; Issues = Errors; Page = Overview + Page state + Blocks). The prototype has no Report; it moves into `page.ts` unchanged, and dock-page removes it.
- Nothing else goes into this change, so the review is a check that code only moved (see "Split hot files by feature first" in the parallel-roadmap skill).
- Module-level state (`panel`, `showTab`, `endPick`) goes into one `shell` state object that the context carries, not a global each module reaches for. Keep imports acyclic: `import/no-cycle` is an error in `.oxlintrc.json`.
