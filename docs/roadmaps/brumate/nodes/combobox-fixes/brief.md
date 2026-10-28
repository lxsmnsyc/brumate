---
id: combobox-fixes
title: ComboBox, Select and Autocomplete keep errors, required messages, picked text and filters right
status: done
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
  - packages/ui/src/ComboBox.brm
  - packages/ui/src/Select.brm
  - packages/ui/src/Autocomplete.brm
  - packages/ui/src/MenuTrigger.brm
  - packages/ui/test/**
  - website/ui/combo-box.md
  - website/ui/select.md
  - website/ui/autocomplete.md
reserves: []
provides: []
depends_on: []
---

# ComboBox, Select and Autocomplete keep errors, required messages, picked text and filters right

## Goal

Fix four bugs found in the docs of ComboBox and Autocomplete (#339), all confirmed on main:

- (a) After a pick, ComboBox and Select drop a server error from `validationErrors`: `edited = true` (ComboBox.brm about 218, Select.brm about 163) is cleared only by a reset. A server error that arrives after a pick should show.
- (b) ComboBox does not copy the browser message of `isRequired` into its FieldError and `data-invalid`; Select does through `onInvalid` (Select.brm about 300). Give ComboBox the same.
- (c) A refused `selectedKey` leaves the picked text in the ComboBox input, also after Tab; the text should return to the kept item (blur clears it today only when the old key is `null`).
- (d) A code write to a bound `inputValue` of an Autocomplete does not change which items show; the filter should follow the value.

Also fix the `isOpen` JSDoc of ComboBox (about line 36) and MenuTrigger (about line 11), which say "Alone it starts … open", against the overlay-start-open finding.

## Context

- Reproduced in the review of ui-docs-pages-collections-2 (#339). The pages describe each bug today; drop those notes when fixed.
- Follow the rule of #332 for refused writes: the part shows the kept value, `onChange` reports the request.

## Acceptance

- [ ] A test per bug, failing on main, and each checked in Chrome.
- [ ] The docs pages drop their notes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: four small fixes in three parts.
