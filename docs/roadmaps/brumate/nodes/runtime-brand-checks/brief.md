---
id: runtime-brand-checks
title: Runtime classes are recognized across two copies of brumate
status: done
priority: should
type: fix
outline: false
milestone: 0.4.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/brand*.test.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/html.ts
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on: []
---

# Runtime classes are recognized across two copies of brumate

## Goal

The runtime checks its own values with `instanceof`, for example `instanceof Internal` in html.ts:264 and 278 and serial.ts:187. With two copies of the runtime in one app, a value made by one copy fails the check in the other. serial.ts then skips the Internal plugin, and `ownValue` silently drops `b-` attributes. Two copies can come from two installed versions of brumate, for example a component library resolved against another copy, or from a linked monorepo where Vite evaluates the runtime again on a hot update while old modules keep the old class.

First reproduce it in a real setup, not only in vitest: two copies of the runtime, or a hot update in the dev server. If it can't happen outside tests, write that in the outcome with the evidence and stop. Otherwise replace the `instanceof` checks of runtime classes that cross module boundaries with a brand check, such as a `Symbol.for('brumate.Internal')` key, and list every class you changed.

## Context

- Found in the review of style-vars-target (#296). In tests, `startLoader` calls `vi.resetModules()`, so a static `renderParts` keeps the old `Internal` class while a fixture imports a fresh one. resume.test.ts works around it with a dynamic import of server.ts (near line 5688). Remove that workaround once the brand check is in.

## Acceptance

- [ ] A reproduction outside vitest, or the evidence that none exists.
- [ ] If it reproduces: a test with two copies of the runtime passes, the resume.test.ts workaround is removed, and the brumate and ui suites pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a brand per class that crosses modules.
