---
id: indicator-timing-function
title: SelectionIndicator accepts a timing function with commas
status: todo
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
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/selection-indicator.ts
  - packages/ui/test/**
  - website/src/routes/ui/_layout.brm
reserves: []
provides: []
depends_on: []
---

# SelectionIndicator accepts a timing function with commas

## Goal

Found by ui-docs-pages-utilities (PR #362) on 2026-10-30: `moveIndicator` in packages/ui/src/selection-indicator.ts splits `transition-timing-function` at the first comma, so `cubic-bezier(0.2, 0, 0, 1)` throws in `animate`. The `.ui-indicator` rule in the website's ui layout uses that value, so the live site hits it. Parse the list of timing functions without splitting inside parentheses.

## Acceptance

- [ ] A test with `cubic-bezier(...)` and `steps(...)` timing functions fails on main and passes.
- [ ] The site's `.ui-indicator` rule animates without an error (e2e or headless Chrome check).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`
