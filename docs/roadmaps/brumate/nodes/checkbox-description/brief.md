---
id: checkbox-description
title: A standalone Checkbox or Switch ties a description and an error to its input
status: todo
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
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/ui/src/Checkbox.brm
  - packages/ui/src/Switch.brm
  - packages/ui/test/**
  - website/ui/checkbox.md
  - website/ui/switch.md
reserves: []
provides: []
depends_on: []
---

# A standalone Checkbox or Switch ties a description and an error to its input

## Goal

A Checkbox or Switch outside a group can have a description and an error message that a screen reader reads with the box: `aria-describedby` on its input points at them, and an invalid box points at its error.

## Context

- Found in the review of ui-docs-pages-forms (#331). Checkbox.brm (about lines 180 and 197) takes `describedBy` only from a CheckboxGroup, and Switch is the same, so a consent box in a form has `aria-invalid="true"` and no description. The docs page says so until this lands.
- Follow how the field parts do it (TextField with `Text slot="description"` and `FieldError`), so the Checkbox can hold the same slots, or take a pass-through, whichever matches the other parts. Decide and say why.
- Update checkbox.md and switch.md, drop their "not tied yet" note, and give the consent demo its description back.

## Acceptance

- [ ] A test: a standalone Checkbox and a Switch with a description and an error have `aria-describedby` on the input naming both, and the error only while invalid.
- [ ] Checked in Chrome's accessibility tree.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two parts and their tests.
