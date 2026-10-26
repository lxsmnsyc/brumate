---
id: docs-overlays
title: Complete the docs of Overlays, Navigation, Status, Layout, Animation and Utilities
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
  - website/ui/dialog.md
  - website/ui/popover.md
  - website/ui/modal.md
  - website/ui/sheet.md
  - website/ui/tooltip.md
  - website/ui/preview-trigger.md
  - website/ui/toast.md
  - website/ui/disclosure.md
  - website/ui/disclosure-group.md
  - website/ui/breadcrumbs.md
  - website/ui/toolbar.md
  - website/ui/meter.md
  - website/ui/progress-bar.md
  - website/ui/group.md
  - website/ui/separator.md
  - website/ui/heading.md
  - website/ui/transition.md
  - website/ui/visually-hidden.md
  - website/ui/keyboard.md
  - website/ui/i18n-provider.md
shared:
  - website/ui/demos/**
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: contract
    via: props-table
---

# Complete the docs of Overlays, Navigation, Status, Layout, Animation and Utilities

## Goal

Bring each page of Overlays, Navigation, Status, Layout, Animation and Utilities in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: dialog, popover, modal, sheet, tooltip, preview-trigger, toast, disclosure, disclosure-group, breadcrumbs, toolbar, meter, progress-bar, group, separator, heading, transition, visually-hidden, keyboard, i18n-provider.
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
