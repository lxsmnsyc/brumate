---
id: visible-forwarded-ref
title: A visible $client waits for a forwarded element
status: todo
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t forwarded
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/plan.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/test/render/refVisibleForward.brm
shared:
  - .changeset/*.md
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on: []
---

# A visible $client waits for a forwarded element

## Goal

A `$client(fn, "visible")` that reads an element through a forwarded ref waits for that element to come into view, as it does for a plain ref.

## Context

- #243 left this gap. The compiler writes `b-near` in `refElement()` of codegen/markup.ts, which keeps only a ref with `ref.scope === scope`, so a forwarded ref, in the child scope, gets none. boot.ts only reads the attribute. The gap is documented in website/docs/components.md.
- Source: Ref forwarding, #243, left out

## Acceptance

- [ ] A resume test: the callback runs when the forwarded element is reported in view, not before.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one place in the loader.
