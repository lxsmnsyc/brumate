# NavigationTree

A tree of links, such as the pages of a site or of a guide, which shows the page that the user is on.

```brm demo NavigationTreeDemo

```

```html
<nav aria-label="Guide">
  <NavigationTree aria-label="Guide" items=pages item=page selectedRoute=(route.url.hash) />
</nav>

#template page(page: Page) {
  <NavigationTreeItem textValue=(page.title) href=(page.href)>
    <Button slot="chevron">▸</Button>
    <NavigationTreeItemLink>{page.title}</NavigationTreeItemLink>
  </NavigationTreeItem>
}
```

- A `NavigationTree` takes `items` and an `item` template, as a [Tree](./tree.md) does. An item can have an `href`. The template renders a `NavigationTreeItem` with a `NavigationTreeItemLink`, which links to the `href` of its item, or shows its text when it has none.
- `selectedRoute` names the page that shows. The item whose `href` is that route is the current one: its link has `aria-current="page"`, and it shows `data-current`. An item that holds it shows `data-current-ancestor` while it is closed, so a mark can show where the page is.
- Nothing is selected. `expandedKeys` holds the keys of the open items, and `onExpandedChange` hears of changes.
- A NavigationTree is no landmark. Put it in a `nav` with a label, as above.
- A row shows `data-href` and the states of a TreeItem, and its level is in the `--tree-item-level` CSS variable.

## Keyboard

- The links are in the order of Tab, as the links of a page are.
- Up and Down move to the link of the next or the previous row that shows, and Home and End to the first and the last.
- Right opens a closed row. Left closes an open row, or else moves to the row that holds it. Right to left, they turn around.
- Enter follows a link. Letters move to the row whose text starts with them.
