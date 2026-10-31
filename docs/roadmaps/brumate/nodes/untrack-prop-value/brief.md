---
id: untrack-prop-value
title: $untrack around a prop value keeps the function and the writes
status: active
priority: should
type: fix
outline: false
milestone: 0.4.1
target: main
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "untrack"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/graph.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on: []
---

# $untrack around a prop value keeps the function and the writes

## Goal

`<Child label=$untrack(nameOf) />` compiles to client code that works: the child gets `nameOf`, and a handler that writes the state `nameOf` reads still writes it.

## Context

- Found in the debate function-prop-derivations (P8, J14), on main's dist: the page ships no client function for `nameOf`, and the handler `name = 'Grace'` compiles to `('Grace')`, so the write is lost. Evidence: docs/debates/function-prop-derivations/evidence/untrack-prop.txt and ParentU.brm.
- A bug on main: branch from main, its own pull request, not stacked on #395 (function-prop-reads).
- Decide first what `$untrack(fn)` as a prop value should mean: the prop stays fixed (as the compile shows) and the function still ships. If it should be a compile error instead, say why in the outcome.

## Acceptance

- [ ] A test with `label=$untrack(nameOf)` fails on main and passes: the child's call returns the current value when it runs, and the handler's write reaches the state.
- [ ] A patch changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one compiler fix and one test.
