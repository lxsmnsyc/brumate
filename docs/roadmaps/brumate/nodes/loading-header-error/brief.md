---
id: loading-header-error
title: "`#loading (expr)` is a compile error instead of dropping its boundary"
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
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# `#loading (expr)` is a compile error instead of dropping its boundary

## Goal

The grammar accepts `#loading (expr) { … } #else { … }` (grammar.md:125), and the parser, analyzer and type check read `LoadingBlock.on` (ast.ts:220, analyze.ts:1439, check.ts:1187). No codegen reads it. With a header, the server output has no boundary and no fallback: it renders the body in place and the page waits for it. Until [loading-on](../loading-on/brief.md) gives the header a meaning, report it as a compile error with a catalog entry, so no page silently loses its fallback.

## Context

- Found on main during the debate in [docs/debates/loading-on-update](../../../../debates/loading-on-update/debate.md) (fact J5). Repro: `docs/debates/loading-on-update/evidence/loading-header.mjs`, output in `loading-header.txt`.
- A main bug: branch from main, its own PR.
- `git log -S block.on` shows only the parser and type-check commits, so nothing ever used the header.

## Acceptance

- [ ] `#loading (data) { … } #else { … }` fails to compile with a new BRMxxx entry that says the header is not supported yet.
- [ ] `#loading { … } #else { … }` compiles as before (codegen snapshot unchanged).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one check, one catalog entry, two tests.
