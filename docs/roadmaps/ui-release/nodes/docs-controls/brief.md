---
id: docs-controls
title: Complete the docs of Buttons and Forms
status: todo
priority: must
type: docs
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
shared:
  - website/ui/demos/**
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: contract
    via: props-table
---

# Complete the docs of Buttons and Forms

## Goal

Bring each page of Buttons and Forms in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: button, toggle-button, toggle-button-group, link, file-trigger, drop-zone, text-field, search-field, token-field, number-field, slider, checkbox, checkbox-group, radio-group, switch, form.
- The props table comes from the generator of docs-generator, through the props-table contract. Do not write props tables by hand.
- The parts and their behavior are in packages/ui/src. Read the doc comment at the top of each part for its attributes and keys.
- Source: [Props tables, anatomy and keyboard tables in the docs](../../../../proposals.md#1-props-tables-anatomy-and-keyboard-tables-in-the-docs)
- Source: [The docs of @brumate/ui](../../../../proposals.md#the-docs-of-brumateui)

## Acceptance

- [ ] Each page has the sections Anatomy, Props, Data attributes, Keyboard (where the part takes keys), Controlled and uncontrolled (where it has state) and Styling.
- [ ] Every new sample compiles: `pnpm --filter website check:samples`.
- [ ] The website builds: `pnpm --filter website build`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 15 pages of docs in one pattern, no code changes.

## Notes for the worker

- Demos live in website/ui/demos. Only edit the demos of the parts on your pages.
- Follow the plain-writing rules: short sentences, no em-dashes, no metaphors.
