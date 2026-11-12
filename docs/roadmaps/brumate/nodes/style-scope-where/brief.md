---
id: style-scope-where
title: Scope attributes add no specificity
status: todo
priority: could
type: feature
story:
early: false
outline: false
milestone: backlog
target:
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
added: 2026-11-12
spent:
owns: []
shared:
  - packages/brumate/src/css.ts
  - packages/brumate/test/styles/**
  - website/docs/styles.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Scope attributes add no specificity

## Goal

A scoped selector keeps the specificity it was written with. Today `scopeSelector` (`packages/brumate/src/css.ts`) appends `[b-c-<scope>]` to every compound, so `.a .b` becomes (0,4,0) instead of (0,2,0), and a parent or `:global` rule needs extra weight to override a component. Writing `:where([b-c-<scope>])` instead keeps the scope and adds nothing.

## Current state

- The attribute goes after the last part of each compound that is not a pseudo-element (`css.ts`, `scopeSelector`). `targets` and `needsScope` do not depend on the selector text, so they stay as they are.
- Block styles scope with the same function (nodes block-styles-scope, live-style-scope-id).

## Acceptance

- [ ] Every scoped compound gets `:where([attr])` in place of `[attr]`, including block styles. Snapshots updated.
- [ ] A test shows a global rule of equal written specificity, later in the page, overrides a scoped rule.
- [ ] `website/docs/styles.md` says scoping adds no specificity. `docs/decisions.md` records the rule.
- [ ] A minor changeset, since rule priority changes (0.x breaks are minor).
- [ ] Size: CSS grows by 8 bytes a compound before gzip; report the gzip change of the website home CSS.

## Sizing

S: one function, snapshots and docs.
