# Outcome: ui-stores-collections

## Built

The collection, menu, select, combobox, table, tree and navigation-tree contexts hold stores, with the pattern of ui-stores-fields and ui-stores-calendar (a named `$memo<T>`, `$toStore(memo)`, `$store(given.state)` in the reader, handlers as literal keys, calls with `!` where a provider always gives them).

- `packages/ui/src/collection.ts`: `ListBoxContext` (`ListBoxProvided`: `state` + `select`, `action`, `setActive`, `startDrag`), `ListBoxGivenContext` (`ListBoxGivenProvided`: `state` + `select`, `tab`), `CollectionFocusContext` (`CollectionFocusProvided`: `state` + `setActive`, `filter`, `filtered`), `SelectValueContext` (a `StoreLike`). `ListBoxState`, `ListBoxGiven` and `CollectionFocus` are data only.
- `packages/ui/src/menu.ts`: `MenuContext` (`MenuGiven`), `MenuTriggerContext` (`MenuTriggerGiven`), `SubmenuContext` (`SubmenuGiven`).
- `packages/ui/src/table.ts`: `TableContext` (`TableGiven`: `state` + `sort`, `toggleAll`), `TableResizeContext` (`TableResizeGiven`: `state` + `start`, `resize`, `end`). `tree.ts`: `TreeContext` (`TreeGiven`). `navigation-tree.ts`: `NavigationTreeContext` and `NavigationLinkContext` as stores. `contexts.ts`: `FieldInputContext` as a store.
- Providers: `ListBox`, `GridList`, `Tree`, `Table`, `ColorSwatchPicker` (ListBoxContext), `Select`, `ComboBox` (ListBoxGivenContext), `ComboBox`, `Autocomplete` (CollectionFocusContext, FieldInputContext), `Menu`, `MenuTrigger`, `SubmenuTrigger`, `Select` (SelectValueContext), `ResizableTableContainer`, `NavigationTree`, `NavigationTreeItem`. `ListBox`, `Menu` and `ComboBox` clear `CollectionFocusContext` and `FieldInputContext` with `store(null)`.
- Readers: `ListBoxItem`, `GridListItem`, `TreeItem`, `Row`, `NavigationTreeItem`, `ListBox`, `Menu`, `MenuItem`, `SubmenuTrigger`, `SelectValue`, `Input`, `TextArea`, `Column`, `ColumnResizer`, `Cell`, `TableHeader`, `TableBody`, `Table`, `NavigationTreeItemLink`.
- `packages/ui/test/field-stores.test.ts`: a second test over 28 parts and 13 contexts, with its own count (more than 10 handler updates scanned). It fails on 85dd0477 (61 problems) and passes here.
- `.changeset/ui-stores-collections.md` (`@brumate/ui` minor).

Acceptance item 1 (no changing value read through the live path) holds for the 13 contexts this node converted only. The Table, Tree and NavigationTree contexts are done here. Other contexts that these parts provide still use the live path.

Warnings still in these parts (ui build, `file:line`), each behind a context left for ui-stores-rest:

- `SelectionIndicatorContext`: TreeItem 79 and 175 (`selected`), Row 53 and 126, GridListItem 71 and 160, ListBoxItem 129.
- `CheckboxGroupContext`: TreeItem 80 (`disabled`, `mode`), Row 54, GridListItem 72. TableHeader gives it too (no warning now, it reads a store).
- `ButtonContext`: TreeItem 95 (`row`) and 97 (`disabled`), GridListItem 153 (`disabled`), Select 271 (`hasDescription`, `invalid`). ComboBox gives it too (no warning now).
- `OverlayTriggerContext`: SubmenuTrigger 102 (`isOpen`) and 109 (`autoFocus`). Select and ComboBox give it too (no warning now).

## Result

Not an experiment node.

## Deviations

- Table, Tree and NavigationTree contexts are in this node, as collection parts, though the brief names lists, menus, select and combobox: `TableContext`, `TableResizeContext`, `TreeContext`, `NavigationTreeContext`, `NavigationLinkContext`.
- Providers of `LabelContext` and the other field contexts were not touched.
- Handlers still produce an `updateContext` in the client part of each provider; the test checks that none reads changing state, as in the earlier two nodes.
- `TableRowContext`, `TreeRowContext`, `ColumnContext` and `SectionContext` stay plain: no warning, and `cells.count` is a counter the cells advance while rendering.
- No shared helper changed.

## Stubs left

Contexts still on the live path, for ui-stores-rest (the `$setContext` warnings of the ui build, `vite build` of `examples/ui`, unique `context value reads` messages: 91 before, 66 after):

- `SelectionIndicatorContext`: eight providers (ListBoxItem, GridListItem, Row, TreeItem, Tab, Radio, Tag, ToggleButton), one reader (SelectionIndicator). Left whole because four providers belong to rest.
- `CheckboxGroupContext` as given by `GridListItem`, `Row`, `TableHeader`, `TreeItem` (their checkbox), `ButtonContext` of `GridListItem`, `TreeItem` and `Select`, `OverlayTriggerContext` of `SubmenuTrigger` (isOpen, autoFocus), `Select` and `ComboBox`.
- Outside these parts: `SliderContext`, `RadioGroupContext`, `TagGroupContext`, `TokenFieldContext`, `DisclosureGroupContext`, `DisclosurePanelContext`, `TransitionContext`, `LocaleContext`, `DateStringsContext`, `LinkContext` of Breadcrumb, `TooltipTriggerContext`, `PreviewTrigger`, `Popover`, `ModalOverlay`, `NumberField` buttons, `Calendar` buttons, `Switch` and `Checkbox` text.

## Gotchas

- `$store($getContext(Ctx).state)` fails (BRM194, BRM127). Use two lines.
- A default of `{ state: store(null) }` makes "no provider" read as `null` from the store, so the old `if (!list)` guards stay.
- A handler that a part forwards from a prop or from the context above (`filter`, `setActive`) reads state in the update; the test lists them as forwarded.
- `Menu` had `closeAll` in its state; `SubmenuTrigger` calls `parentGiven.closeAll` and falls back to the trigger's.

## Proposed learnings

- Read a store from a context in two statements | one line fails BRM194 | packages/ui/src | yes (the compile fails)

## Verification

- `pnpm lint` (exit 0, warnings only), `pnpm format:check` (pass), `pnpm typecheck` (pass).
- `npx vitest run` in packages/ui, 73 files in four groups, all pass (1 expected fail), excluding `bind-kept-writes` and `token-field-sync`.
- field-stores on 85dd0477 `packages/ui/src`: fails; here: passes.
- Ui example JS (vite build of `examples/ui`, gzip -9 per file in `dist/assets`, summed): base 85dd0477 201,987 B, now 203,141 B (+1,154 B, +0.57%). Not a measure of `load`.
- ui e2e (`node e2e/run.mjs --only ui`): 55 passed, 0 failed.

## Size

- Estimated M, actual M.
