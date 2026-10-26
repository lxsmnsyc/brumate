---
id: code-examples
title: Rewrite the code examples of the docs with the markup features
status: todo
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - website/docs/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Rewrite the code examples of the docs with the markup features

## Goal

Go through the code examples of website/docs and write each with the features of the markup where they fit: `{name}` and `{onClick}` shorthands, `ref=$bind`, `prevent` and blocks. Format each one.

## Context

- The idioms are in the memory note brm-idioms and in the docs of markup. Every sample is checked by `check:samples`.
- Source: [The code examples](../../../../proposals.md#the-code-examples)

## Acceptance

- [ ] Every sample compiles: `pnpm --filter website check:samples`.
- [ ] No example writes `name=name` where `{name}` works.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: many small edits in one folder.
