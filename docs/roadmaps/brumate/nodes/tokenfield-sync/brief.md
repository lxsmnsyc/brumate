---
id: tokenfield-sync
title: TokenField's box follows the kept value after a refused write, a reset and a fast edit
status: todo
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/TokenField.brm
  - packages/ui/src/TokenInput.brm
  - packages/ui/test/**
  - website/ui/token-field.md
  - website/ui/state.md
reserves: []
provides: []
depends_on: []
---

# TokenField's box follows the kept value after a refused write, a reset and a fast edit

## Goal

The contenteditable box of a TokenField always shows its value: after a refused `$bind` write, after a form reset, and after quick edits followed by a reset.

## Context

- Found in the review of ui-docs-pages-fields (#342), on main. Not the gap that bind-read-your-writes fixes:
  - TokenInput.brm (about lines 102-116) writes the box only in an effect on `field.value`; a refused edit leaves the value unchanged, so the box keeps the typed text.
  - TokenField.brm (about lines 71-75) `setValue` returns early when the first segments equal the kept ones, so a reset does not rewrite the box; a contenteditable has no native reset.
  - Own state: Backspace twice, type `@zed `, Reset: the box shows `@zed` while `data-token="@ada"`. `write()` (TokenInput.brm about 55-82) copies from `[data-stamp]` nodes that have not re-rendered yet.
- Rewrite the box from the value on a refused typed edit and on a form reset, and read the stamps after they render. Drop the TokenField exception in website/ui/state.md and token-field.md.

## Acceptance

- [ ] Tests for all three cases, failing on main; checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one part's write path.
