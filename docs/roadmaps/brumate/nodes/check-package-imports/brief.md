---
id: check-package-imports
title: brumate check resolves imports from packages as the vite plugin does
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-29
owns:
  - packages/brumate/src/check-command.ts
shared:
  - .changeset/*.md
  - packages/brumate/test/check-command.test.ts
reserves: []
provides: []
depends_on: []
---

# brumate check resolves imports from packages as the vite plugin does

## Goal

`brumate check` resolves an import of a `.brm` module from a package, such as `@brumate/ui/data.brm.ts`, the same way the vite plugin does. A file that builds with vite no longer gets BRM167 ("Cannot read ...") from the check.

## Context

- Found by ui-docs-pages-collections-3 (#344): `brumate check` reports BRM167 on the four Data demos in website/ui/demos, while the vite build, the samples check and the e2e flow compile them. The bug is on main.
- check-command.ts compiles with a disk-only resolver. vite.ts also calls `resolvePackageImport` from packages.ts for bare specifiers. Share that resolution instead of copying it.
- A bug on main: branch from main, its own PR.

## Acceptance

- [ ] A test: `brumate check` on a file that imports a `.brm` module of a package reports no BRM167, and a missing module still does.
- [ ] `npx brumate check` on website/ui/demos reports no BRM167 on the Data demos.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one resolver call and one test.
