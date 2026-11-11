---
id: editor-sizes
title: What ships, in the editor
status: dropped
priority: must
type: feature
outline: false
milestone: 0.8.0
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
shared:
  - .changeset/*.md
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

## Dropped (2026-11-11, maintainer)

The maintainer dropped the feature. A hover that shows what a handler ships must bundle the handler with its imports; the review measured own-code numbers at 5-36% off and imports left out (a Calendar handler: 120 B own code, 4.6 kB with calendar.ts). Bundling needs rolldown in the language server, which the platform-neutral VS Code extension would ship as a wasm binding of about 15-20 MB. The work is kept on the local branch feat/editor-sizes (8cd11cad: rolldown bundle per hovered part, caches by mtime, imported components, LRU of 8), not merged.

