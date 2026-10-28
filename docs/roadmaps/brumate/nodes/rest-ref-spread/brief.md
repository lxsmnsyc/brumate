---
id: rest-ref-spread
title: A ref in the rest props reaches the element that spreads them
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "a ref left in the rest props"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/RestRefBox.brm
  - packages/brumate/test/render/restRefPage*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/html.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: spread-children-live
    kind: hard
    why: both change the client write path of inserts and spreads
  - on: ordered-updates
    kind: hard
    why: a bound element is written through the update code that ordered-updates rewrites
---

# A ref in the rest props reaches the element that spreads them

## Goal

A component that leaves `ref` in its rest props and spreads them onto an element, `<button {...rest}>`, gives the element to a parent's `ref=$bind(root)`. Today `root` stays undefined, while `ref=$bind(ref)` written on the element works. The maintainer confirmed on 2026-10-27 that the core should support this.

## Context

- The failing test is already on main: `it.fails` "a ref left in the rest props reaches the element that spreads them" in packages/brumate/test/resume.test.ts, with fixtures test/render/RestRefBox.brm and restRefPage.brm, added by ref-reaches-element (#280). Turn it into `it`.
- Find where the binding is lost: the server `spread` (runtime/html.ts, runtime/server.ts), the page state (a `Binding` in a rest slot), or the client spread (`spreadEntries`, `attrs` in runtime/client/). dynamic-spread-anchor (#255) fixed a related case, a forwarded ref through a spread onto a component; read its outcome.
- Cover a spread in a block that the browser renders, and a rest that changes after the first render, as well as the server render.
- The element must stay out of the page state (the test "leaves the element out of the page state" next to it).

## Acceptance

- [ ] The `it.fails` test is `it` and passes, plus a test for a spread in a block that the browser renders.
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one binding path through a spread.
