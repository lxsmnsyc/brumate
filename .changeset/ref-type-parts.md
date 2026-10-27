---
'@brumate/ui': patch
---

The forwarded `ref` of ListBox, ListBoxItem, Menu, MenuItem, GridList, GridListItem, Tree, TreeItem, TabList, Tab, TabPanel, TagList, Tag, Link, Button and Heading takes an optional element, so `ref=$bind(signal)` with a caller's `$signal<HTMLElement>()` type checks.
