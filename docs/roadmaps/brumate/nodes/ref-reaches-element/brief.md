---
id: ref-reaches-element
title: A ref bound on Link, Button or Heading reaches its element
status: done
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/ref-forward.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/ui/src/Link.brm
  - packages/ui/src/Button.brm
  - packages/ui/src/Heading.brm
  - packages/ui/test/ref-forward.test.ts
  - packages/ui/test/fixtures/refForward.brm
shared:
  - .changeset/*.md
  - packages/ui/test/fixtures/as-collections.brm
reserves: []
provides: []
depends_on:
  - on: ref-type-parts
    kind: hard
    why: it edits the props of the same three parts
---

# A ref bound on Link, Button or Heading reaches its element

## Goal

`<Link ref=$bind(sig)>`, `<Button ref=$bind(sig)>` and `<Heading ref=$bind(sig)>` set `sig` to the rendered element, also with a component in `as`. Today the signal stays undefined: these parts leave `ref` in `rest` and spread it, and a binding in a spread does not reach the element. A plain `<p ref=$bind(...)>` on the same page works.

## Context

- Found by the review of #275 (ref-type-parts), which has a probe page in its comment. The bug is on main; #275 changed types only.
- part-props v1.3 says a part with a forwarded ref destructures it from its own props and writes `ref=$bind(ref)` on its root. Do that in the three parts.
- Then decide whether a binding in a spread onto an element should work in the core. If it should, write a failing packages/brumate test and report it as a gap; do not fix the core in this node.
- The comment at packages/ui/test/fixtures/as-collections.brm:29 about signals that do not fit the ref type is stale after #275; update it if bound-element-signal (#277) has merged, so the signals can be `$signal<HTMLElement>()`.

## Acceptance

- [ ] A test mounts each of the three parts with `ref=$bind(sig)`, and with `as=AsTarget`, and reads the element from the signal. It fails on main and passes with the fix.
- [ ] `pnpm --filter @brumate/ui exec vitest run` and `pnpm --filter @brumate/ui typecheck` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: three parts and one test.
