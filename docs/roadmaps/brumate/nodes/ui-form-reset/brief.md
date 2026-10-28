---
id: ui-form-reset
title: Every form part of @brumate/ui resets with its form
status: todo
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/**
  - packages/ui/test/**
  - website/ui/state.md
reserves: []
provides: []
depends_on: []
---

# Every form part of @brumate/ui resets with its form

## Goal

A `reset` of the form gives every part with a `name` back the value it started with, the way Select and TextField do: Checkbox, Switch, CheckboxGroup, RadioGroup, ComboBox, SearchField and TokenField included.

## Context

- Found in the review of ui-docs-kit (#323): state.md claimed every part resets, but these parts have no reset handler in packages/ui/src. A native checkbox resets its own `checked`, but the part's state (its signal and `data-selected`) does not follow.
- Select resets with `selectedKey = initialKey` (Select.brm, about line 226), which goes through a `$bind(signal, fn)` setter, so a setter that refuses also refuses the reset. Decide whether a reset should pass the setter or go around it, apply one rule to all parts, and write it in docs/decisions.md.
- Share one helper for the reset listener if the parts can use it, rather than a copy in each.
- Update website/ui/state.md to match.

## Acceptance

- [ ] A test per part: change the value, reset the form, and the part, its `data-*` state and its hidden input show the first value.
- [ ] state.md says what reset does, with no exceptions left.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one listener in seven parts, with a shared helper and tests.
