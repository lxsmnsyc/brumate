---
id: client-fixes
title: Ref setters after the render, and three small divergence fixes
status: todo
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: client-audit
    kind: hard
    why: items 2 and 4 of its removals
---

# Ref setters after the render, and three small divergence fixes

## Goal

Items 2 and 4 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md), one node:

- setter-after-render: a ref setter called after the browser render goes through the client export, not a render closure over stale locals. The fix sits in `send` for setters only (changing every `handlerProp` call made 3 new pages differ). Fixes ref-setter-relay, 5 pages.
- memo-reject: `failOnce` reports to `onError` even when a `#try` catches the error; report only what no `#try` catches, as the server does.
- class-order: `classList.add` puts conditional classes last; the browser writes the classes in the server's order (the maintainer chose to fix it, 2026-11-03).
- template-import is fixed on `main` by #438 (0.5.1); remove its entry when `main` syncs into `next`, not here.

## Acceptance

- [ ] ref-setter-relay, memo-reject and class-order leave the differential test's list.
- [ ] Todos within 0.3 kB.
- [ ] A patch changeset.

## Sizing

S.
