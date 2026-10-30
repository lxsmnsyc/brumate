---
id: transition-sibling-text
title: Text beside a Transition that unmounts does not break the browser render
status: done
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
  - packages/ui/src/**
  - packages/brumate/src/runtime/**
  - packages/ui/test/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# Text beside a Transition that unmounts does not break the browser render

## Goal

Found by ui-docs-pages-utilities (PR #362) on 2026-10-30: plain text in the same parent as a `Transition` that unmounts on leave throws "Missing end marker" in the browser. The Transition demo wraps the text in a `<span>` to avoid it. Find whether the part or the core block markers are at fault, and fix it there.

## Acceptance

- [ ] A test with text beside an unmounting Transition fails on main and passes.
- [ ] The Transition demo can drop its `<span>` workaround.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`
