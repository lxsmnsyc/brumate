---
id: coverage-script
title: A coverage script for the brumate tests
status: todo
priority: should
type: chore
outline: false
milestone: 0.9.0
target:
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
  - package.json
  - packages/brumate/package.json
  - packages/brumate/vitest.config.ts
  - pnpm-lock.yaml
  - website/docs/contributing.md
reserves: []
provides: []
depends_on: []
---

# A coverage script for the brumate tests

## Goal

The client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md) measured coverage with `@vitest/coverage-v8`, only on its spike branch. Add it as a dev dependency with a `coverage` script, so later nodes can show statement and branch coverage of the runtime. It found that the tests run with every feature flag on and that the off paths of 12 of 17 flags run only in e2e; record that in the script's output or the docs for contributors.

## Acceptance

- [ ] `pnpm --filter brumate coverage` prints coverage of packages/brumate/src/runtime/**.
- [ ] CI does not run it (it is for local use).
- [ ] Items 9 and 10 of the client audit ride along (added 2026-11-12): `feature-flags-off.test.ts` also turns off rootWait, clientHTML, loading, lateMarkup, children, templates and bindings, and `getScope` (scopes.ts), which only resume.test.ts calls, is no longer exported.

## Sizing

S.
