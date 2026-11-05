---
id: context-docs
title: Docs, examples and decisions for contexts without defaults
status: active
priority: must
type: docs
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - website/docs/**
  - examples/**
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-no-defaults-4
    kind: hard
    why: the docs describe the finished API
---

# Docs, examples and decisions for contexts without defaults

## Goal

The last node of docs/debates/context-no-defaults/debate.md. Rewrite the default sections of website/docs/context.md (lines 37 to 81 on the story branch) for `createContext(key)`, the throw and `$hasContext`; update the 12 website docs calls and the 4 examples/tracker calls (examples/tracker/src/user.ts still passes a default: TS2554), and skills/brumate/references/state.md, which still shows `createContext('light')`. Add a decisions.md entry in its own format, linking the debate: contexts have no default, a read without a provider throws, `$hasContext` and the guarded `$store` are the optional read, and why (a default is module-global). Set the debate's `decision:` field to the entry.

## Acceptance

- [ ] No doc or example passes a default to `createContext`.
- [ ] The decisions.md entry and the debate link.
- [ ] The changesets of the story read as one change for this API.

## Sizing

S.
