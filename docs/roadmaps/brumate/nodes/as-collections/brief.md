---
id: as-collections
title: as and ref on the collection parts
status: todo
priority: should
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/as-collections.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/ListBox.brm
  - packages/ui/src/ListBoxItem.brm
  - packages/ui/src/Menu.brm
  - packages/ui/src/MenuItem.brm
  - packages/ui/src/GridList.brm
  - packages/ui/src/GridListItem.brm
  - packages/ui/src/Tree.brm
  - packages/ui/src/TreeItem.brm
  - packages/ui/src/TabList.brm
  - packages/ui/src/Tab.brm
  - packages/ui/src/TabPanel.brm
  - packages/ui/src/TagList.brm
  - packages/ui/src/Tag.brm
  - packages/ui/test/as-collections.test.ts
shared:
  - packages/ui/test/props-types.ts
  - packages/ui/test/fixtures/AsTarget.brm
reserves: []
provides: []
depends_on:
  - on: props-types-main
    kind: hard
    why: as.ts and the exported props types are on main only after #245 merges
---

# as and ref on the collection parts

## Goal

Give the collection parts an `as` prop that takes an element name or a component, and forward `ref`: ListBox, ListBoxItem, Menu, MenuItem, GridList, GridListItem, Tree, TreeItem, TabList, Tab, TabPanel, TagList and Tag.

## Context

- These parts read their root and their items through `ref` for keys, focus and typeahead. Since ref forwarding (#243), a component in `as` gives them the element too.
- Terracotta renders its listbox and options as any element, with the right role.
- A part that binds its own root uses the `ref` prop as its root signal, as the part-props contract says.
- Use packages/ui/test/fixtures/AsTarget.brm as the component in `as`. If as-controls has not written it yet, write the same file.
- Out of scope: Checkbox, Radio, Switch, the Table parts, Modal, ModalOverlay, Sheet, MenuSection, ListBoxSection, and the Slider and Color parts. Their element is their meaning, or their code reads a fixed structure. Say so in the outcome if one turns out to be cheap.
- Source: Polymorphism, from the review of the parts against Terracotta (2026-10-26)

## Acceptance

- [ ] Each part renders `<{as ?? <default>}>`, with its role, and takes the props of its target.
- [ ] The keyboard tests of each collection pass with a component in `as`.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one pattern on 13 parts. The keyboard code reads elements, so each part needs its tests run with a component target.
