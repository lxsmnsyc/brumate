# Log: ui-stores-collections

- Base 85dd0477 (refactor/ui-stores-calendar). Built it first, measured the ui example: 201,987 B (calendar recorded 201,986 B).
- Pattern of fields and calendar: `{ state: $toStore(memo), ...handlers }`, reader `$store(given.state)`. A context default is `{ state: store(null) }`; outside a provider the store reads `null`, so `if (!list)` guards still work.
- The reset `$setContext(CollectionFocusContext, null)` became `{ state: store(null) }` (plain `store` from `brumate/store` in the .brm). It compiles and the test finds no update that reads state.
- `$store($getContext(Ctx).state)` in one line fails with BRM194/BRM127. Two lines: `const given = $getContext(Ctx); const x = $store(given.state);`.
- `ListBoxGiven` kept its name for the data (selectedKeys, labelledBy, focusStrategy); `select` and `tab` moved to `ListBoxGivenHandlers`.
- `filter` (a prop of Autocomplete) and `setActive` (forwarded by ListBox and Menu from the field above) read state to find the function, so the test lists them as forwarded handlers like `isDateUnavailable`.
- `TableContext.columns` is still a mutable array that each Column pushes to while rendering. It sits in the memo of the Table by reference, and table, virtualizer and navigation tests pass.
- `TableRowContext` (`cells.count` counter) and `TreeRowContext` (`row` prop) and `SectionContext`, `ColumnContext` have no warning and were not moved.
- `SelectionIndicatorContext` has eight providers (ListBoxItem, GridListItem, Row, TreeItem, Tab, Radio, Tag, ToggleButton) and one reader; four belong to other waves, so it was left for ui-stores-rest.
- Ui tests: all 73 files in four groups pass; field-stores fails on 85dd0477 `packages/ui/src` (61 problems) and passes here.
