---
id: ui-docs-pages-controls
title: Anatomy, use cases, CSS and state on the pages of Buttons and Forms
status: done
priority: should
type: docs
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - website/ui/button.md
  - website/ui/toggle-button.md
  - website/ui/toggle-button-group.md
  - website/ui/link.md
  - website/ui/file-trigger.md
  - website/ui/drop-zone.md
  - website/ui/text-field.md
  - website/ui/search-field.md
  - website/ui/token-field.md
  - website/ui/number-field.md
  - website/ui/slider.md
  - website/ui/checkbox.md
  - website/ui/checkbox-group.md
  - website/ui/radio-group.md
  - website/ui/switch.md
  - website/ui/form.md
  - website/ui/demos/Button*.brm
  - website/ui/demos/ToggleButton*.brm
  - website/ui/demos/ToggleButtonGroup*.brm
  - website/ui/demos/Link*.brm
  - website/ui/demos/FileTrigger*.brm
  - website/ui/demos/DropZone*.brm
  - website/ui/demos/TextField*.brm
  - website/ui/demos/SearchField*.brm
  - website/ui/demos/TokenField*.brm
  - website/ui/demos/NumberField*.brm
  - website/ui/demos/Slider*.brm
  - website/ui/demos/Checkbox*.brm
  - website/ui/demos/CheckboxGroup*.brm
  - website/ui/demos/RadioGroup*.brm
  - website/ui/demos/Switch*.brm
  - website/ui/demos/Form*.brm
shared:
  - website/src/routes/ui/_layout.brm
  - website/ui/demos/Landing*.brm
reserves: []
provides: []
depends_on:
  - on: ui-docs-kit
    kind: hard
    why: it makes the anatomy and styled-example blocks and the Select page that these pages follow
---

# Anatomy, use cases, CSS and state on the pages of Buttons and Forms

## Goal

Bring every page of Buttons and Forms up to the pattern of the Select page from ui-docs-kit:

- an anatomy picture above the Anatomy section, with numbered callouts tied to the tag tree;
- two or three use cases that compose the part with others, such as a part in a form with validation or inside a toolbar, each a live demo with its source;
- a styled example with its complete CSS;
- a section on controlled and uncontrolled with an example of each shape that the part's state props allow, the change callbacks and form reset, linking to state.md.

## Context

- Read docs/roadmaps/brumate/nodes/ui-docs-kit/outcome.md first, and copy the Select page's structure.
- The maintainer's review on 2026-10-28 asked for these four on every part page.
- A part without state skips the controlled and uncontrolled section; a part without pieces (one element) gets no anatomy picture. Say which in the outcome.
- Check each use case against the code: claims that did not match the code were the main review finding of the earlier docs nodes.
- Style demos with the site's demo classes in website/src/routes/ui/_layout.brm; give a new demo class a name of its own (the slider and switch once shared `ui-track`).
- Never name React Aria.

## Acceptance

- [ ] Every page in owns has the four parts above, or the outcome says why one is skipped.
- [ ] Samples compile, the website builds, its tests and the /ui e2e flows pass, and axe finds no new violation on the pages.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about a dozen pages of the same pattern.
