# Outcome: ui-no-defaults-3

## Built

- Twenty contexts lost their default, in `packages/ui/src`:
  - `collection.ts`: `ListBoxContext`, `ListBoxGivenContext`, `CollectionFocusContext`, `SectionContext`, `SelectValueContext`.
  - `virtualizer.ts`: `VirtualizerContext`. `menu.ts`: `MenuTriggerContext`, `MenuContext`, `SubmenuContext`.
  - `tree.ts`: `TreeContext`, `TreeRowContext`. `token-field.ts`: `TokenFieldContext`, `TokenContext`.
  - `table.ts`: `TableContext`, `TableRowContext`, `TableResizeContext`, `ColumnContext`.
  - `navigation-tree.ts`: `NavigationTreeContext`, `NavigationLinkContext` (read by NavigationTreeItem, a collection part).
  - `contexts.ts`: `DialogContext`. Unassigned by the briefs; Menu reads it, so this node took it (Dialog.brm changed only on its two `DialogContext` lines and the `$hasContext` import).
  - The `store` import went from the seven `.ts` files that no longer use it.
- Readers (`packages/ui/src`, each guarded with `$hasContext(C) ? ... : undefined`, `$hasContext` added to the `brumate/signals` import): ListBox, ListBoxItem, ListBoxSection (sets only), Header, SelectValue, Menu, MenuItem, SubmenuTrigger, GridList, GridListItem, Row, Cell, Column, ColumnResizer, Table, TableBody, TableHeader, Tree, TreeItem, Token, TokenInput, NavigationTreeItem, NavigationTreeItemLink, Dialog.
- Where a handler read `x.handler`, it now reads `x?.handler` (a guarded variable is `undefined` without a provider). `!` calls under an existing guard (`if (!list) return`) keep the `!` after `?.`.
- `.changeset/ui-no-defaults-3.md`: `@brumate/ui`, minor.
- Old default against guarded read with no provider: `{ state: store(null) }` read as `state` value `null`, now `undefined`; `null` read now `undefined`. Every reader tests it by truthiness or `?.` (grep for `=== null` and `=== undefined` on these variables found only unrelated ones), so each part behaves as before. No fallback is built anywhere; there is no module-scope fallback and no immutable constant added.

## Result

Not an experiment node.

Example client JS (`examples/ui`, `vite build --outDir dist/client`, gzip -9 summed over every `.js`): 203,132 B on the base (a023ecd9), 203,352 B after (+220 B, the longer guards).

## Deviations

- The brief says ui tests and `node e2e/run.mjs --only ui` pass. They cannot until group 4, since its contexts still throw. e2e not run.
- Contexts of `tabs.ts`, `tags.ts`, `slider.ts`, `tooltip.ts`, `toast.ts`, `selection-indicator.ts` and `DisclosurePanelContext` were left: no collection part reads them and no test throws on them. They go to group 4.

## Stubs left

- Contexts still with a default (TS2554 count 42 before, 22 after), for group 4:
  - `contexts.ts`: `DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `ModalOverlayContext`, `ColorSwatchContext`, `ColorPickerContext`.
  - `calendar.ts` (`DatePickerContext`, `CalendarContext`, `CalendarGridContext`), `date-strings.ts`, `segments.ts` (`DateFieldContext`, `DateRangeFieldContext`), `color-thumb.ts`, `color-wheel.ts`, `transition.ts`.
  - `tabs.ts`, `tags.ts`, `slider.ts`, `tooltip.ts`, `toast.ts` (2), `selection-indicator.ts`.
- Ui test files that fail now: 35 of 75 (47 before). 26 of them throw on a group 4 context: `overlay-trigger` (26 throws), `disclosure-group` (18), `color-picker` (14), `date-strings` (8), `modal-overlay` (6), `date-picker` (4), `color-swatch` (3), `transition` (1), `date-range-field` (1). None throws on a group 3 context.
- Nine files fail in the full run without a thrown context: bind-kept-writes, color-swatch-picker, field-stores, form-reset, generics-markup, preview, table, token-field-sync, tooltip. Run alone: bind-kept-writes, field-stores, form-reset, preview, table and tooltip pass (load flakes); color-swatch-picker throws `color-picker` (group 4); generics-markup asserts that the fixtures typecheck with no error, so it fails on the 22 TS2554 of group 4; token-field-sync passed in two of three solo runs (the page-load wait of 150 ms is tight; it also passes on the base).

## Gotchas

- `$store(x.state)` must be guarded by the context of `x`; a script that rewrote `$getContext` lines and then the `$store(x.state)` lines of the same variables did most of the 22 readers.
- Handlers of a guarded variable need `x?.`; typecheck lists each one as TS18048.
- Menu reads `DialogContext` and `CollectionFocusContext`, and also sets `CollectionFocusContext` and `SubmenuContext` with `store(null)` for what is inside it; those sets stay.
- `generics-markup.test.ts` fails until the TS2554 count is 0.

## Proposed learnings

- None new beyond ui-no-defaults-1's.

## Verification

- `npx oxlint`: 0 errors. Root `npx oxfmt --check`: pass.
- `brumate-tsc --noEmit` in packages/ui: 42 TS2554 before, 22 after; no other error.
- `npx vitest run` in packages/ui: 35 files fail (260 tests), 40 pass; before, 47 of 75 failed. Every thrown failure names a group 4 context; the nine other files are classified above.
- `node e2e/run.mjs --only ui`: not run (group 4).

## Size

- Estimated M, actual M: 22 reader files, 8 `.ts` files and a changeset.
