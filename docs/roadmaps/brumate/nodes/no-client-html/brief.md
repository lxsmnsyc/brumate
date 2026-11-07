---
id: no-client-html
title: Drop the HTML-string machinery from the client
status: todo
priority: should
type: refactor
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
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/**
  - .changeset/*.md
  - packages/brumate/src/features.ts
reserves: []
provides: []
depends_on:
  - on: clone-remaining-bodies
    kind: hard
    why: every body clones first
---

# Drop the HTML-string machinery from the client

## Goal

Item 5 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md): once every body clones (clone-remaining-bodies), `#template` calls and children return fragments, and the HTML-string parse path and the `CLIENT_HTML` flag go (about 80 runtime lines, an estimate).

## Acceptance

- [ ] No client output parses an HTML string for a body, a template call or children; the `CLIENT_HTML` flag is gone.
- [ ] The JS before `load` of the website and the ui example is recorded before and after.
- [ ] Todos within 0.3 kB (the flag is already off there).

## Sizing

M.
