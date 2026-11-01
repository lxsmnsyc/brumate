---
id: cold-paths-spike
title: "Spike: drop the cold runtime paths that usage-pruning-spike did not check"
status: todo
priority: should
type: spike
story:
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: S
spike: true
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-11-01
spent:
owns:
  - docs/roadmaps/brumate/nodes/cold-paths-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: usage-pruning-flags
    kind: hard
    why: measure on top of the five flags, with the same facts and tests
---

# Spike: drop the cold runtime paths that usage-pruning-spike did not check

## Goal

usage-pruning-spike left about 1.7 kB raw minified of code that todos loads and never runs, unchecked in its time box. For each, find whether a fact in the compiled output proves a build never needs it, measure the gzip saving on todos, dashboard, rows and the website, and propose flags or refactors.

## Context

- The maintainer asked for this on 2026-11-01, at the gate of usage-pruning-spike. The list, from its outcome (raw minified on todos):
  - the `html.ts` helpers the core keeps (`styleValue`, `insertValue`, `switchWords`, `toKebabCase`, `escape`): about 600 B
  - the serial plugins of `produce.ts` (`useSerialEntry`, `registerValues`, `Binding`, `SlotReference`): about 700 B
  - `send` (props to a child): 224 B
  - `withVariables` (CSS variables in `style`): 191 B
  - the rest: `smoke.mjs` with `DUMP=90` in the spike folder lists it.
- Paths with no provable fact (`asyncMemo`, `refresh` of client scopes, the skew reload, `destroyRange` and list `leave`) are out of scope, as the spike found.
- A false "unused" is a production break; follow the test list of usage-pruning-flags.

## Acceptance

- [ ] outcome.md with a fact (or "none") and a measured saving per path, and the build nodes to add (gate: the maintainer decides).

## Sizing

S: time-boxed to one day.
