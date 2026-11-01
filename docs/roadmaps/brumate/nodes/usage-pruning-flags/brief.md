---
id: usage-pruning-flags
title: Five feature flags drop the runtime paths a build never uses
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - packages/brumate/src/features.ts
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/test/feature-flags.test.ts
  - packages/brumate/test/features.test.ts
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/boot.ts
reserves: []
provides: []
depends_on:
  - on: usage-pruning-spike
    kind: hard
    why: the maintainer said go on 2026-11-01; prototype-flags.patch and the outcome's test list are the starting point
---

# Five feature flags drop the runtime paths a build never uses

## Goal

Add five flags to the existing feature mechanism, each set from a fact in the compiled output of the build: `#try` (tries), element `$bind` fields (fields), windowed lists (windows), dynamic tags (dynamic) and routes (routes). A build that never uses a path ships without its code. Todos goes from about 14.8 kB to about 13.8 kB gzip of JS before `load`.

## Context

- The maintainer chose approach F (flags) and said go at the gate of usage-pruning-spike on 2026-11-01. Start from `nodes/usage-pruning-spike/prototype-flags.patch` (applies to `next`), which has the facts with the two review fixes: `fields` also matches `$$b.binding(` (a `$bind` that reaches an element through rest props), and `routes` matches `routeContext` and `navigationContext` by name.
- A fact that misses is a production break the current tests cannot see: they run the runtime with every flag on. Add every test from the outcome's "Stubs left" list: per-fact true and false cases, the check over the render fixtures that ties `b-catch`, `=$bind#` and `=$set:` in server HTML to the flag, runtime tests with each flag off, core builds with each flag on and off, and a built page with `features: 'used'` that uses @brumate/ui `Input` with `$bind` and types before the core loads.
- Optional in this node: the windowed-list refactor (`list` takes the park code from `windowList` as functions), which drops the `windows` fact.
- The flags are per build: every page of a build shares one core. The website builds with `features: 'all'` and does not change.

## Acceptance

- [ ] Each of the five flags is off in a build that does not use its path, and on in one that does, with the tests above.
- [ ] `pnpm bench` todos gzip JS before `load` is about 1.0 kB below 14.8 kB; dashboard and rows numbers are in the outcome.
- [ ] `pnpm build && pnpm test && node e2e/run.mjs` pass.

## Sizing

M: the prototype is close; most of the work is the tests.
