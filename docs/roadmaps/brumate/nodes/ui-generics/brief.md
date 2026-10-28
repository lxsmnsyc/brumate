---
id: ui-generics
title: Type parameters for the values of the parts
status: done
priority: should
type: feature
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui typecheck
exclusive: []
fulfilled_by: 
gate: false
added: 2026-10-26
owns:
  - packages/ui/src/ListBox.brm
  - packages/ui/src/GridList.brm
  - packages/ui/src/Table.brm
  - packages/ui/src/TableBody.brm
  - packages/ui/src/Tree.brm
  - packages/ui/src/TreeRow.brm
  - packages/ui/src/NavigationTree.brm
  - packages/ui/src/ToastRegion.brm
  - packages/ui/src/Select.brm
  - packages/ui/src/ComboBox.brm
  - packages/ui/src/TagGroup.brm
  - packages/ui/src/TagList.brm
  - packages/ui/src/Autocomplete.brm
  - packages/ui/src/collection.ts
  - packages/ui/src/toast.ts
  - packages/ui/test/generics-types.ts
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: as-collections
    kind: hard
    why: both edit the generics and props of ListBox, GridList, Tree and TagList
  - on: as-controls
    kind: hard
    why: both edit the props of ToastRegion
  - on: element-types
    kind: contract
    via: element-types
---

# Type parameters for the values of the parts

## Goal

The parts that take values take a type parameter for them, as Terracotta does with `<V, T extends ValidConstructor>`. `items`, the `item` template, `getTextValue`, the selected keys and values, and `onSelectionChange` read `V`, so nothing falls back to `any`.

## Context

- Template props are `(item: any) => unknown` in ListBox, GridList, Table, TableBody, Tree, TreeRow and NavigationTree, and ToastRegion takes `QueuedToast<any>`.
- A generic component infers its type parameters from its props since #241, so `<ListBox items=(animals) item=animal>` infers `V`.
- A part with `as` has two parameters: the value `V` and the target `T`.
- Source: Request of the user, 2026-10-26: the parts do not use component generics, as Terracotta does

## Acceptance

- [ ] packages/ui/test/generics-types.ts shows that `item` gets the type of `items`, and that a wrong field of an item is an error.
- [ ] No `any` is left in the props of these parts.
- [ ] `pnpm --filter @brumate/ui typecheck` and the ui tests pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one pattern on about a dozen parts.
