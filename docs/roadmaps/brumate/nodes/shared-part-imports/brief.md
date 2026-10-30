---
id: shared-part-imports
title: A shared client part imports the names its functions use
status: done
priority: must
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
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/src/*.ts
  - packages/brumate/test/**
  - packages/ui/test/**
reserves: []
provides: []
depends_on: []
---

# A shared client part imports the names its functions use

## Goal

A bug on main, found on 2026-10-30 (CI of #379 and the review of #376). `packages/ui/src/ToggleButtonGroup.brm` imports `sameKeys` from `./collection.ts` and calls it in `toggle` (since #372). The compiler moves `toggle` into the `shared` client part (`ToggleButtonGroup.brm?brumate-client&part=shared`), but that part's code has no `import { sameKeys }`, so the browser throws `ReferenceError: sameKeys is not defined` when a toggle runs (website e2e "/ui utility pages", and @brumate/ui tests once the part loads). Other parts that #372 changed may have the same shape (ListBox, GridList, Table, Tree, TagGroup, Menu, CheckboxGroup, Slider).

Fix the import collection for the shared part in the compiler (packages/brumate/src/codegen), so any part emits the imports its functions use. Check how the handler parts (`h20`, `h21`) collect theirs, which works.

Branch from main, its own PR, not stacked.

## Acceptance

- [ ] A codegen test: a function used by a handler and by markup (so it lands in the shared part) that calls an imported helper; the shared part imports it. It fails on main.
- [ ] Compile every component in packages/ui/src and assert that no client part uses an imported name it does not import (a test, so it stays fixed).
- [ ] The @brumate/ui tests and `node e2e/run.mjs --only website` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one import collection in codegen, two tests.
