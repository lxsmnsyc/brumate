# Outcome: docs-collections

## Built

- The 13 part pages of Collections and Data in website/ui follow the props-table contract: list-box, grid-list, menu, select, combo-box, autocomplete, tabs, tag-group, selection-indicator, table, tree, navigation-tree, virtualizer. Each has a `props` block for every part it covers.
- Doc comments for the props of 36 parts in packages/ui/src (176 comments, comments only): ListBox, ListBoxItem, ListBoxSection, Header, GridList, GridListItem, Menu, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger, Select, SelectValue, ComboBox, Autocomplete, Tabs, TabList, Tab, TabPanel, TagGroup, TagList, Tag, SelectionIndicator, Table, TableHeader, TableBody, Column, Row, Cell, ResizableTableContainer, ColumnResizer, Tree, TreeItem, NavigationTree, NavigationTreeItem, NavigationTreeItemLink, Virtualizer. No prop of these parts has an empty Description (37 blocks, 228 rows checked with `readProps`). TreeRow has none, since callers never write it.
- Every sample that renders items from data has a typed `#template` parameter, and the pages say that a template parameter takes a type: list-box, grid-list, table, tree, navigation-tree, select, virtualizer, data.
- Changeset .changeset/docs-collections.md (patch, @brumate/ui).

Sections per page (A anatomy, P props, D data attributes, K keyboard, C controlled and uncontrolled, S styling). x = written, - = left out on purpose.

| Page                | A   | P   | D   | K   | C   | S   |
| ------------------- | --- | --- | --- | --- | --- | --- |
| list-box            | x   | x   | x   | x   | x   | x   |
| grid-list           | x   | x   | x   | x   | x   | x   |
| menu                | x   | x   | x   | x   | x   | x   |
| select              | x   | x   | x   | x   | x   | x   |
| combo-box           | x   | x   | x   | x   | x   | x   |
| autocomplete        | x   | x   | x   | x   | x   | x   |
| tabs                | x   | x   | x   | x   | x   | x   |
| tag-group           | x   | x   | x   | x   | x   | x   |
| selection-indicator | x   | x   | x   | -   | -   | x   |
| table               | x   | x   | x   | x   | x   | x   |
| tree                | x   | x   | x   | x   | x   | x   |
| navigation-tree     | x   | x   | x   | x   | x   | x   |
| virtualizer         | x   | x   | x   | x   | -   | x   |
| data                | -   | -   | -   | -   | -   | -   |

Left out: Keyboard and Controlled for SelectionIndicator (no keys, no state). Controlled for Virtualizer (no state). The data page documents two functions, not a part, so it has none of the part sections.

## Deviations

- The old prose stays under the demo and in the sections after Styling, as on the docs-controls pages. The old `## Keyboard` prose is now `## Focus and keys`, and the `## Tabs` section of tabs.md is `## The tab`.
- Autocomplete has an Anatomy although it renders only its children, because the page shows how the field and the collection nest.
- The data page changed by one sentence on the type of the template parameter.
- The Virtualizer doc comment was out of date, so it now says which collections window with `items`.
- Demos are unchanged. Their templates already had typed parameters.

## Stubs left

- None.

## Gotchas

- Menu `Tab` row: the page says Tab closes an open menu. Not run in a browser.
- GridList, Table, Tree, Tag and Tabs key tables follow the old prose and the key handlers. Not checked one key at a time in a browser.
- `data-focused` of ListBoxItem is also set for the active item of a field (virtual focus). The table says so.
- `Header` is described on the list-box page only. A later page for it must not repeat its comment.
- TableBody, TableHeader, Row, Cell and ColumnResizer take `[attribute: string]: unknown`, so their other attributes are not in the table.
- `data-sized`, `data-width`, `data-min-width`, `data-max-width` and `data-key` are set on Column but left out of the table, since they are internal. `data-collection` on lists is too.
- ComboBox `isRequired` and Select `isRequired` differ: ComboBox makes the input required with `aria-required`, Select asks the browser to check the hidden input. The comments say so in each.
- `Menu` has `selectionMode` and `disabledKeys` but no `selectionBehavior`, `orientation` or `escapeKeyBehavior`. Not a doc problem, but the pages differ from ListBox here.
- `shouldCloseOnSelect` of a Menu defaults to true, and to false for a multiple selection. The prop's default cell is empty, since the default is computed.

## Proposed learnings

- Read a part's data attributes from its markup, not from its older prose | prose drifts, and the table is a contract | website/ui | no

## Verification

- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx tsdown` in packages/brumate, packages/tsc and packages/language-core, then `npx vite build` (client and ssr) in website: passes; every `props` block resolves.
- Website tests: 9 passed.
- `npx brumate-tsc --noEmit` in packages/ui and in website: exit 0.
- `npx vitest run --maxWorkers=2` in packages/ui: 58 files, 540 passed, 1 expected fail.
- `npx oxlint --quiet`: exit 0. Root `npx oxfmt --check`: passes.
- Public repo; no workflow was triggered.

## Size

- Estimated M, actual M.
