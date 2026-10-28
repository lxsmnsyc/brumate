---
id: pending-submit
title: A pending submit Button keeps its form from sending again
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
  - packages/ui/src/Button.brm
  - packages/ui/test/**
  - website/ui/button.md
  - website/ui/demos/ButtonSaveDemo.brm
reserves: []
provides: []
depends_on: []
---

# A pending submit Button keeps its form from sending again

## Goal

While a submit Button is pending, its form does not submit again, by a click or by Enter in a field. The maintainer chose option A on 2026-10-28: the pending button stays `type="submit"` and blocks the submit itself, so the fix stays in Button.

## Context

- Found in the review of ui-docs-pages-controls (#326). Today a pending Button switches to `type="button"` (Button.brm), so the form has no submit button left, and with one text field the browser submits on Enter. Measured in Chrome: Save, then Enter while saving, gives two submits.
- Keep `type="submit"` while pending, keep `aria-disabled` and focus as now, and cancel the form's `submit` event while pending (for example a capture listener on the form that prevents a submit whose submitter is this button, or whose submitter is null for implicit submission when this button is the form's default button). Decide what happens with two submit buttons in one form, and say so.
- Then simplify website/ui/demos/ButtonSaveDemo.brm (drop its guard if it is no longer needed) and make button.md say the pending button prevents a second submit.
- Patch changeset for @brumate/ui.

## Acceptance

- [ ] A test: a pending submit Button in a form with one text field; a click and Enter during pending give no second submit; after pending ends, Enter submits.
- [ ] Checked in real Chrome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one part, a listener and a test.
