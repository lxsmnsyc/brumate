---
id: context-writer-loop
title: An effect that calls a context's writer does not run again on its own write
status: active
priority: should
type: fix
outline: false
milestone: 0.4.1
target: main
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "context writer"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/graph.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - website/docs/context.md
  - website/docs/effects.md
reserves: []
provides: []
depends_on: []
---

# An effect that calls a context's writer does not run again on its own write

## Goal

A child `$effect(() => ctx.add(1))`, under a provider whose context object holds `add` and a value that `add` writes, runs once per change it depends on, not without end.

## Context

- Found in the debate function-prop-derivations (O7, O12), on main: the effect ran 51 times per click (the probe's cap). The provider re-sends the context when the state it reads changes, and the effect depends on the context, so each write re-runs it. The client has no update-depth guard (O1), so the tab hangs. Evidence: docs/debates/function-prop-derivations/evidence/opp-ctxEff.brm and opp-CtxEffMid.brm.
- A bug on main: branch from main, its own pull request.
- Look at how a function in a `$setContext` object is made live today: it follows its reads even when it also writes (debate evidence context-function.txt). The debate settled function props on option C2 (a function that writes outside `$untrack`, or calls through a context or prop, stays fixed). Check whether the same rule fits context functions, and what that changes for ui parts that read context functions in markup.
- The workaround today is `$untrack(ctx.add(1))` in the effect, as effects.md teaches.

## Acceptance

- [ ] A test of the loop fails on main and passes.
- [ ] The ui suite passes; list any part whose output changes.
- [ ] A patch changeset for brumate, and docs if the context rule changes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the context rule in the graph, tests, and a check of the ui parts.
