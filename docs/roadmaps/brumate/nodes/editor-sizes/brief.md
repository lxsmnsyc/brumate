---
id: editor-sizes
title: What ships, in the editor
status: todo
priority: could
type: feature
outline: false
milestone: agent-skill
target:
from:
size: M
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/language-server/src/**
shared: []
reserves: []
provides: []
depends_on: []
---

# What ships, in the editor

## Goal

The language server shows the gzip size of each handler, update and `$client` callback, and when it loads, as an inlay hint or a hover, from the analysis of `brumate inspect`.

## Context

- `brumate inspect` already reports what each component ships.
- Source: [What ships, in the editor](../../../../proposals.md#what-ships-in-the-editor)

## Acceptance

- [ ] A hover on a handler shows its size and when it loads.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: new to the language server.
