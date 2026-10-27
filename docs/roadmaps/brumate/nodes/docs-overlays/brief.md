---
id: docs-overlays
title: Complete the docs of Overlays, Navigation, Status, Layout, Animation and Utilities
status: todo
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
  - website/ui/demos/Dialog*.brm
  - website/ui/demos/Popover*.brm
  - website/ui/demos/Modal*.brm
  - website/ui/demos/Sheet*.brm
  - website/ui/demos/Tooltip*.brm
  - website/ui/demos/PreviewTrigger*.brm
  - website/ui/demos/Toast*.brm
  - website/ui/demos/Disclosure*.brm
  - website/ui/demos/DisclosureGroup*.brm
  - website/ui/demos/Breadcrumbs*.brm
  - website/ui/demos/Toolbar*.brm
  - website/ui/demos/Meter*.brm
  - website/ui/demos/ProgressBar*.brm
  - website/ui/demos/Group*.brm
  - website/ui/demos/Separator*.brm
  - website/ui/demos/Heading*.brm
  - website/ui/demos/Transition*.brm
  - website/ui/demos/VisuallyHidden*.brm
  - website/ui/demos/Keyboard*.brm
  - website/ui/demos/I18NProvider*.brm
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
  - on: ui-generics
    kind: hard
    why: it changes the props types and defaults that the tables show
---

# Complete the docs of Overlays, Navigation, Status, Layout, Animation and Utilities

## Goal

Bring each page of Overlays, Navigation, Status, Layout, Animation and Utilities in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: dialog, popover, modal, sheet, tooltip, preview-trigger, toast, disclosure, disclosure-group, breadcrumbs, toolbar, meter, progress-bar, group, separator, heading, transition, visually-hidden, keyboard, i18n-provider.
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
