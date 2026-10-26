---
id: a11y-in-tests
title: Accessibility checks in brumate/testing
status: todo
priority: should
type: feature
outline: false
milestone: agent-skill
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/testing-a11y.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/brumate/src/runtime/testing.ts
  - packages/brumate/test/testing-a11y.test.ts
  - website/docs/testing.md
shared: []
reserves: []
provides: []
depends_on: []
---

# Accessibility checks in brumate/testing

## Goal

`mount` and `visit` return `checkAccessibility(options)`, which runs axe-core on what they rendered and throws with each violation. Page-level rules are off for a mounted component and for an inert page. axe-core is an optional peer dependency.

## Context

- The ui e2e runs axe-core in Chrome already. a11y.ts in the compiler is a different, compile-time lint.
- Source: [Accessibility checks in tests](../../../../proposals.md#accessibility-checks-in-tests)

## Acceptance

- [ ] A test mounts a button with no name, and the check throws.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one method and its rules. It adds a peer dependency, which changes the lockfile.
