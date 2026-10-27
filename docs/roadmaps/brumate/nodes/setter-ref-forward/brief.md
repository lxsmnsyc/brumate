---
id: setter-ref-forward
title: A ref bound with a setter receives the element
status: todo
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "a ref bound with a setter"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/setterRef*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: rest-ref-spread
    kind: hard
    why: it adds the forward through rest props that this node extends to setters
---

# A ref bound with a setter receives the element

## Goal

`ref=$bind(root, fn)` calls `fn` with the element in the browser, on an element and through a component's rest props that are spread on an element. Today the forward checks `isSlotReference(binding.target)`, so a setter is skipped, both for a `ref` written on the element and for one in the rest props.

## Context

- Found in the review of rest-ref-spread (#290). Read its outcome: `restRef` and `forwardRef`.
- The server has no element, so the setter runs in the browser once the element exists, after resume and after a block renders. Decide whether the setter runs on resume for markup the server rendered, and say so in the outcome.
- The element stays out of the page state.

## Acceptance

- [ ] Tests: a setter ref on an element, and through rest props spread on an element, each call the setter once with the element after resume, and again when a block renders it.
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one more target kind in the forward.
