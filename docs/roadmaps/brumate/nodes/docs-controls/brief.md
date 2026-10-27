---
id: docs-controls
title: Complete the docs of Buttons and Forms
status: active
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by: 
gate: false
added: 
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
  - .changeset/*.md
  - packages/ui/src/*.brm
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: hard
    why: the props-table format and its renderer exist only after docs-generator
  - on: as-controls
    kind: hard
    why: it changes the props types and defaults that the tables show
---

# Complete the docs of Buttons and Forms

## Goal

Bring each page of Buttons and Forms in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: button, toggle-button, toggle-button-group, link, file-trigger, drop-zone, text-field, search-field, token-field, number-field, slider, checkbox, checkbox-group, radio-group, switch, form.
- The props table comes from the generator of docs-generator, through the props-table contract. Do not write props tables by hand.
- Write against the frozen props-table contract (contracts/props-table.md). Most props have no doc comment yet, so their Description cells are empty: write a one-sentence doc comment for each prop of your parts in packages/ui/src, and never name React Aria. See nodes/docs-generator/outcome.md.
- The parts and their behavior are in packages/ui/src. Read the doc comment at the top of each part for its attributes and keys.
- Source: [Props tables, anatomy and keyboard tables in the docs](../../../../proposals.md#1-props-tables-anatomy-and-keyboard-tables-in-the-docs)
- Source: [The docs of @brumate/ui](../../../../proposals.md#the-docs-of-brumateui)

## Acceptance

- [ ] Each page has the sections Anatomy, Props, Data attributes, Keyboard (where the part takes keys), Controlled and uncontrolled (where it has state) and Styling.
- [ ] Every sample of the pages compiles: `pnpm --filter website check:samples`, which reads website/ui since docs-generator.
- [ ] The website builds: `pnpm --filter website build`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 15 pages of docs in one pattern, no code changes.

## Notes for the worker

- Demos live in website/ui/demos. Only edit the demos of the parts on your pages.
- Follow the plain-writing rules: short sentences, no em-dashes, no metaphors.
