---
id: clone-remaining-bodies
title: The bodies that still render from an HTML string clone their template
status: todo
priority: should
type: refactor
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/clone-bodies.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/clone-bodies.test.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - packages/brumate/test/__snapshots__/**
reserves: []
provides: []
depends_on:
  - on: no-html-string-fallback
    kind: hard
    why: it moved every other body to cloned templates and keeps the list of the rest
---

# The bodies that still render from an HTML string clone their template

## Goal

Finish what no-html-string-fallback started: no body that the browser renders falls back to an HTML string. After it, 19 bodies of the test pages still render from `$$html` (listed in packages/brumate/test/clone-bodies.test.ts), and so do `#template` functions (`$$b.raw`) and children closures.

- An in-place `#try` (markers plus a rollback of `$$html`): needs a nodes form of `#try`, such as a `tryNodes` helper.
- A windowed `#for`, `#offscreen`, and bodies that wait in their script.
- `#template` functions and children: need a fragment return for template calls.

## Context

- From no-html-string-fallback's outcome and its fresh review (2026-11-03). The held-write fixes (#419, #421) do not reach the in-place `#try` pages yet, so this node covers them too.
- Until values-build lands, keep pending and fallback state in scope slots, not new hold-back helpers (docs/decisions.md, the client restructure entry).
- The differential test lists known divergences; a fix that makes one match removes its entry.
- Split into two PRs if the `#try` nodes form and the template fragment return turn out independent.

## Acceptance

- [ ] test/clone-bodies.test.ts lists no body, and no `#template` function returns `$$b.raw`.
- [ ] A constant async memo fills in place in an in-place `#try` body, on the server and in the browser.
- [ ] Todos within 0.3 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M, possibly two: a nodes form of `#try` and a fragment return for template calls.
