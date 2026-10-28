---
id: ui-refused-write-sync
title: A part shows the value its caller keeps when a $bind setter refuses a write
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
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
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: ui-form-reset
    kind: hard
    why: it found the gap and its reset tests and docs are the starting point
---

# A part shows the value its caller keeps when a $bind setter refuses a write

## Goal

When a part's value is bound with `$bind(signal, fn)` and `fn` refuses a write (a user edit or a form reset), the part, its thumbs or segments, and its native and hidden inputs all show the value the caller keeps.

## Context

- Found in Chrome in the review of ui-form-reset (#325), and the same on main. With a refusing setter and a form reset:
  - NumberField shows 3 while its inputs say 7;
  - ColorField shows `#E2445A` while the edited value is `#0000FF`;
  - ColorSlider, ColorArea and ColorWheel thumbs jump back (hue 213 to 210) while the value stays;
  - TimeField shows 2:30 PM while the hidden input keeps `15:32`;
  - DateRangePicker's start segment shows 10/12/2026 while the hidden input keeps `2026-11-14`.
- Checkbox, Switch, the groups, ComboBox, SearchField, TokenField, TextField, Select, Slider and DateField already stay in sync. Compare how they do it: the likely cause is a display value (text, thumb position, segments) kept apart from the bound value and not re-read when the write is refused.
- Check a refused user edit too (typing, dragging, arrow keys), not only a reset.
- Remove the "not yet in sync" list from website/ui/state.md and docs/decisions.md that #325 adds.

## Acceptance

- [ ] A test per part with a refusing setter: after an edit and after a reset, the part's display, `data-*` and inputs show the kept value.
- [ ] Checked in real Chrome, as the #325 review did.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: seven parts that likely share one or two causes.
