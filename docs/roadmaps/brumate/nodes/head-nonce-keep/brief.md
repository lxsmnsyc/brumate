---
id: head-nonce-keep
title: Client navigation keeps head elements that carry a CSP nonce
status: todo
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-19
spent:
owns: []
shared:
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/test/**
  - e2e/suites/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

> 2026-11-19: found by the external-scripts review. external-scripts strips the nonce only behind its `scripts` flag; on `main` nothing strips it.

# Client navigation keeps head elements that carry a CSP nonce

## Goal

`updateHead` in `runtime/navigate.ts` (main, about line 513) keys head elements by `outerHTML`. With a CSP nonce, the server gives every response its own nonce, and the browser hides the live element's nonce (`nonce=""`), so a nonce'd `<style>`, `<link>` or `<script>` in the head never matches the next page's copy. Each client navigation adds the element again and removes the old one: styles reapply, and a head script runs again.

## Acceptance

- [ ] Prove it first on `main`: a test (or e2e step) with a nonce shows a head element replaced on navigation.
- [ ] `updateHead` compares head elements without the `nonce` attribute; the same element is kept across navigations under a CSP.
- [ ] A patch changeset.
- [ ] Fast check passes; e2e website suite passes.
