---
id: client-markup-docs
title: Document $client in markup that the browser renders
status: todo
priority: should
type: docs
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/client-order.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - website/docs/effects.md
  - packages/brumate/test/client-order.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Document $client in markup that the browser renders

## Goal

Write the section on when `$client` runs for a component that the browser renders, such as in an `#if` that opens, and add a test of the order.

## Context

- The user asked when `$client` runs for a component rendered on the client. The answer goes in effects.md.
- Source: [$client in markup that the browser renders](../../../../proposals.md#client-in-markup-that-the-browser-renders)

## Acceptance

- [ ] A test shows that the callback runs after the markup is in the page.
- [ ] The section is in effects.md, and its samples compile.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one section and one test.
