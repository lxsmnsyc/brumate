---
id: docs-collections
title: Complete the docs of Collections and Data
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
  - website/ui/list-box.md
  - website/ui/grid-list.md
  - website/ui/menu.md
  - website/ui/select.md
  - website/ui/combo-box.md
  - website/ui/autocomplete.md
  - website/ui/tabs.md
  - website/ui/tag-group.md
  - website/ui/selection-indicator.md
  - website/ui/table.md
  - website/ui/tree.md
  - website/ui/navigation-tree.md
  - website/ui/virtualizer.md
  - website/ui/data.md
  - website/ui/demos/ListBox*.brm
  - website/ui/demos/GridList*.brm
  - website/ui/demos/Menu*.brm
  - website/ui/demos/Select*.brm
  - website/ui/demos/ComboBox*.brm
  - website/ui/demos/Autocomplete*.brm
  - website/ui/demos/Tabs*.brm
  - website/ui/demos/TagGroup*.brm
  - website/ui/demos/SelectionIndicator*.brm
  - website/ui/demos/Table*.brm
  - website/ui/demos/Tree*.brm
  - website/ui/demos/NavigationTree*.brm
  - website/ui/demos/Virtualizer*.brm
  - website/ui/demos/Data*.brm
shared: []
reserves: []
provides: []
depends_on:
  - on: docs-generator
    kind: hard
    why: the props-table format and its renderer exist only after docs-generator
  - on: as-collections
    kind: hard
    why: it changes the props types and defaults that the tables show
---

# Complete the docs of Collections and Data

## Goal

Bring each page of Collections and Data in website/ui to the shape of the Terracotta and Headless UI pages: an anatomy tree, a props table from the exported types, a table of the data attributes, a keyboard table, a controlled and an uncontrolled example, and a styling example with data attributes. Format the demo code of these pages.

## Context

- Pages: list-box, grid-list, menu, select, combo-box, autocomplete, tabs, tag-group, selection-indicator, table, tree, navigation-tree, virtualizer, data.
- The props table comes from the generator of docs-generator, through the props-table contract. Do not write props tables by hand.
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
