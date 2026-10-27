---
id: dynamic-tag-rest-ref
title: A ref in the rest props reaches a dynamic tag that spreads them
status: done
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "dynamic tag that spreads the rest"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/RestRefTag*.brm
  - packages/brumate/test/render/restRefTagPage*.brm
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
    why: it adds restRef and the forward of a ref in the rest props, which this node extends to dynamic tags
---

# A ref in the rest props reaches a dynamic tag that spreads them

## Goal

A component that writes `<{as} {...rest}>` with a plain element in `as`, and leaves `ref` in its rest props, gives that element to a parent's `ref=$bind(root)` on the first render. Today `root` stays undefined until the spread updates, because the dynamic tag path of codegen/markup.ts (the attributes of a dynamic tag, near line 1514) never wraps its attributes in `restRef`.

## Context

- Found in the review of rest-ref-spread (#290). Read its outcome first: the gate in codegen/markup.ts and `restRef` on the server and the client.
- This is the pattern of the @brumate/ui parts and of any component with an `as` prop. Start by checking whether the ui parts leave `ref` in their rest or name it, and say which in the outcome.
- Cover the server render, a block that the browser renders, and a change of `as` between two elements after the first render.

## Acceptance

- [ ] A test "a ref left in the rest props reaches a dynamic tag that spreads the rest" passes for the server render and for a block that the browser renders.
- [ ] The element stays out of the page state.
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the dynamic tag path gets the same wrap as an element.
