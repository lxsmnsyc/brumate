---
id: field-error-clears
title: A field's native error clears once its value is valid again
status: todo
priority: should
type: fix
outline: false
milestone: ui-0.1
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
  - packages/ui/src/ColorField.brm
  - packages/ui/src/NumberField.brm
  - packages/ui/test/**
reserves: []
provides: []
depends_on: []
---

# A field's native error clears once its value is valid again

## Goal

After a ColorField (and NumberField, if it has the same shape) shows a native validation error, fixing the value clears the error text and `data-invalid`, as TextField does.

## Context

- Found in the review of ui-docs-pages-colors-dates (#334), on main. ColorField.brm (about lines 444-459) clears `nativeErrors` only on reset; TextField.brm (about line 218) re-checks on input. NumberField.brm (about line 339) looks the same as ColorField.
- Repro on /ui/color-field, form demo: Save with the field empty, type `f0f`, blur, Save. The form sends `#FF00FF`, but the error text and `data-invalid` stay until Reset.
- Follow TextField's rule, and check every other form field part for the same shape.

## Acceptance

- [ ] A test per affected part: an error shows, the value is fixed, and the error and `data-invalid` are gone.
- [ ] Checked in Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one re-check in two parts and their tests.
