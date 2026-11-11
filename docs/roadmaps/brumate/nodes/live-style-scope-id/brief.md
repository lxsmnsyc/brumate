---
id: live-style-scope-id
title: Live style variables on elements the browser renders outside the component's render function
status: todo
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.7.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/styles
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-11
spent:
owns: []
shared:
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Live style variables on elements the browser renders outside the component's render function

## Goal

An element that the browser renders with the component's live style variables gets `b-v="<scope id>"`, so `setVar` updates it. Today `emitLiveStyles` (packages/brumate/src/codegen/markup.ts:2157-2163) writes `this.scopeVar(component)` with no `.id`. Outside the component's own render function (a `{children}` closure, a `#if` branch the browser opens) that name is the scope object, so the attribute is `b-v="[object Object]"`, `[b-v~="id"]` never matches it, and the element keeps its first value. Same for the spread path at markup.ts:2806.

## Context

- Found by the fresh review of block-styles (2026-11-11). Reproduced on release/0.8 aa8650ae: a page with a `#if` shown by a click holding `<Inner><span class="x">hi</span></Inner>`, file style `.x { width: ${w}px }` with `w` a signal, Inner renders `{children}`. After the click the span has `b-v="[object Object]"`; changing `w` leaves it at the first value. A row the browser adds to a top-level `#for` stays stale the same way.
- `bindingScope` (markup.ts:786) already writes `.id` when the scope is not inside the current render function; follow it.
- The block-styles batch (PR #513) moves this code (`liveVariableScopes`, kept byte-identical). release-0.7.1 merges main into release/0.8, so the conflict is resolved there: apply the same `.id` rule in `liveVariableScopes`.
- Output changes for packages/ui TreeItem and ColorThumb (expected).

## Acceptance

- [ ] A browser-render test that fails on main: the repro above; after the click and a change of `w`, the span has the new value. Also a browser-added row of a top-level `#for`.
- [ ] Patch changeset for `brumate`.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, full brumate vitest.
