---
id: try-template-call-site
title: "A #try catches a #template by where it is called, at runtime"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.4.2
target: main
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/graph.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: try-template
    kind: hard
    why: builds on the calledTemplates and t-table rules of #420
---

# A #try catches a #template by where it is called, at runtime

## Goal

A client error in a `#template` reaches the `#try` around the place where the template is called, whatever scope declares the template and wherever else it is called.

## Context

- Left open by try-template (#420) on 2026-11-02, both also on `main` (see docs/roadmaps/brumate/nodes/try-template/outcome.md):
  - A template called both inside and outside a `#try`: the call inside is not caught.
  - A template declared above the scope that holds the `#try`, for example a top-level template called in a `#try` inside a `#for`: not caught, and the `#catch` code ships though it cannot run.
- #420 links a template's scopes to a `#try` at build time (`calledTemplates`, `triesTable`). These cases need a runtime link from a template scope to its call site, so `fail` walks the caller's scopes.
- Confirm both on `main` with failing tests first.
- Report the todos size of `pnpm bench --only brumate --scenario todos` (within 0.3 kB).

## Acceptance

- [ ] Tests that fail on `main` and pass with the fix, for both cases, in packages/brumate/test/resume.test.ts.
- [ ] The #420 tests still pass.
- [ ] A patch changeset for brumate.

## Sizing

M: a runtime link in the scope tree and the build-time table it replaces or extends.
