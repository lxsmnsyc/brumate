---
id: template-call-insert-scopes
title: Each insert of a template call gets its own scope on the server
status: done
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: L
risk: high
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/differential
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-27
spent: 491243
owns:
  - docs/roadmaps/brumate/nodes/template-call-insert-scopes/**
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/differential/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: memo-template-resume
    kind: hard
    why: replaces its client workaround (sharedScopes) and removes its accepted divergence
---

# Each insert of a template call gets its own scope on the server

## Goal

memo-template-resume (PR #538, 0.9.1) fixed a resumed memo of a template call that is inserted twice on the client: the server renders the memo once, so both inserts share one scope and its markup appears twice with the same `b-b` key. The client now detects the shared scope (`sharedScopes` in `client/state.ts`, filled by `indexElement` in `client/blocks.ts`) and re-renders each insert. The server and browser renders still differ in their scopes, recorded as the accepted divergence `memo-template-twice` in `test/differential/data.ts` (pages `memoTemplateTwice`, `memoTemplateThrice`). The maintainer chose (2026-11-27) to ship the client fix and schedule the server fix here.

Make the server give each insert of a template call its own scope, as the browser does, so the renders match and the client workaround can go.

## Context

- Read `nodes/memo-template-resume/outcome.md` (on main after #538 merges, else on branch `hotfix/memo-template-resume`). Its "Server fix sized" item lists the parts: a lazy value in place of the rendered `Raw` of a template call (`codegen/patch.ts`), `runtime/server.ts` (`insert`, `Lazy`, the state serializer for a memo slot), and the client resume of a memo slot, which must turn the sent value into a `TemplateCall`.
- The same shape holds for any value holding a template call: a `const`, a signal, a prop. Cover them all; a gap on one of them is a bug, not a limit.
- Merge main into `release/0.10` first if #538 is not there yet.

## Acceptance

- [ ] The `memo-template-twice` divergence entry is gone and the differential pages match, for a memo, a `const`, a signal and a prop holding a template call, inserted two and three times.
- [ ] The client workaround `sharedScopes` is removed, or the outcome says why a part of it must stay.
- [ ] Resume, render and differential tests pass; `node e2e/run.mjs` passes.
- [ ] Todos gzip JS before `load` reported (`pnpm bench --only brumate --scenario todos`).
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

L: codegen, the server insert and state, and the client resume of memo slots, across four value kinds.
