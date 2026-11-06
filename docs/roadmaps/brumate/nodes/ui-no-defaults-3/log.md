# Log: ui-no-defaults-3

- Start: base a023ecd9. TS2554 42, ui test files failing 47 of 75 (from the ui-no-defaults-2 outcome).
- Files (src): collection.ts, menu.ts, table.ts, tree.ts, token-field.ts, virtualizer.ts, navigation-tree.ts (contexts); readers ListBox, ListBoxItem, Header, SelectValue, Menu, MenuItem, SubmenuTrigger, GridList, GridListItem, Row, Cell, Column, ColumnResizer, Table, TableBody, TableHeader, Tree, TreeItem, Token, TokenInput, NavigationTreeItem, NavigationTreeItemLink.
- Contexts taken: ListBox, ListBoxGiven, CollectionFocus, Section, SelectValue, Virtualizer, MenuTrigger, Menu, Submenu, Tree, TreeRow, Token, TokenField, Table, TableRow, TableResize, Column, NavigationTree, NavigationLink (read by collection parts).
- Readers rewritten with a script from the guarded idioms; the optional chain `x?.handler` replaces `x.handler` where the type is now `| undefined`.
