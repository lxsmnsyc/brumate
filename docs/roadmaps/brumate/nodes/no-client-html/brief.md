---
id: no-client-html
title: Drop the HTML-string machinery from the client
status: done
priority: should
type: refactor
outline: false
milestone: 0.10.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent: 501285
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
  - on: template-fragment-return
    kind: hard
    why: #template functions and children must clone too (split from clone-remaining-bodies, 2026-11-25)
---

# Drop the HTML-string machinery from the client

## Goal

> 2026-11-26: template-fragment-return makes `#template` functions clone, but its `rawNodes` still goes through `holdPlace` (a `<!--fN-->` string parsed by `insertHTML`), so `clientHTML` turns on for every page with a template. Read its outcome for the list of what this node must change first (`Raw` carrying a DocumentFragment; `insert`, `linkCalls` and the content/fill paths placing nodes; then deleting `holdPlace`, `placed`, the `<!--fN-->` parse and the `rawNodes(` clause in features.ts; the remaining `return $$html;` functions).

Item 5 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md): once every body clones (clone-remaining-bodies), `#template` calls and children return fragments, and the HTML-string parse path and the `CLIENT_HTML` flag go (about 80 runtime lines, an estimate).

## Acceptance

- [ ] No client output parses an HTML string for a body, a template call or children; the `CLIENT_HTML` flag is gone.
- [ ] The JS before `load` of the website and the ui example is recorded before and after.
- [ ] Todos within 0.3 kB (the flag is already off there).

## Sizing

M.
