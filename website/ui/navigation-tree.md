# NavigationTree

A tree of links, such as the pages of a site or of a guide, which shows the page that the user is on.

```brm demo NavigationTreeDemo

```

```html
<nav aria-label="Guide">
  <NavigationTree aria-label="Guide" items=pages item=page selectedRoute=(route.url.hash) />
</nav>

#template page(page) {
  <NavigationTreeItem textValue=(page.title) href=(page.href)>
    <Button slot="chevron">▸</Button>
    <NavigationTreeItemLink>{page.title}</NavigationTreeItemLink>
  </NavigationTreeItem>
}
```

- A `NavigationTree` takes `items` and an `item` template, as a [Tree](./tree.md) does. An item can have an `href`. The template's parameter takes its type from `items`. The template renders a `NavigationTreeItem` with a `NavigationTreeItemLink`, which links to the `href` of its item, or shows its text when it has none.
- `selectedRoute` names the page that shows. The item whose `href` is that route is the current one: its link has `aria-current="page"`, and it shows `data-current`. An item that holds it shows `data-current-ancestor` while it is closed, so a mark can show where the page is.
- Nothing is selected. `expandedKeys` holds the keys of the open items, and `onExpandedChange` hears of changes.
- A NavigationTree is no landmark. Put it in a `nav` with a label, as above.
- A row shows `data-href` and the states of a TreeItem, and its level is in the `--tree-item-level` CSS variable.

## Anatomy

```html
<NavigationTree>
  <NavigationTreeItem>
    <Button slot="chevron" />
    <NavigationTreeItemLink />
  </>
</>
```

The NavigationTree renders a `NavigationTreeItem` for each item through its `item` template. The `Button` is optional.

## Props

### NavigationTree

```props NavigationTree

```

### NavigationTreeItem

```props NavigationTreeItem

```

### NavigationTreeItemLink

```props NavigationTreeItemLink

```

## Data attributes

### NavigationTreeItem

| Attribute               | When                                     |
| ----------------------- | ---------------------------------------- |
| `data-href`             | The item has an `href`.                  |
| `data-current`          | Its `href` is the `selectedRoute`.       |
| `data-current-ancestor` | It is closed and holds the current item. |

It also shows the attributes of a [TreeItem](./tree.md#data-attributes).

### NavigationTreeItemLink

| Attribute       | When                             |
| --------------- | -------------------------------- |
| `data-current`  | The link is to the current page. |
| `data-disabled` | The item is disabled.            |

## Keyboard

Right to left, Left and Right turn around.

| Key                      | Action                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `Tab`                    | Moves focus to the next link, as on any page.                 |
| `ArrowDown` or `ArrowUp` | Moves to the link of the next or the previous row that shows. |
| `Home` or `End`          | Moves to the first or the last link.                          |
| `ArrowRight`             | Opens a closed row.                                           |
| `ArrowLeft`              | Closes an open row, else moves to the row that holds it.      |
| `Enter`                  | Follows the link.                                             |
| `a` to `z`               | Moves to the row whose text starts with what was typed.       |

## Controlled and uncontrolled

`expandedKeys` holds the keys of the open items. `expandedKeys=(['docs'])` starts the tree's own state, and `expandedKeys=$bind(signal)` writes your signal. `onExpandedChange` gets the keys after each change. `selectedRoute` is set by the caller, usually from the route. Nothing is selected. See [State](./state.md).

## Styling

Style the page that shows with `[data-current]`, and a closed item that holds it with `[data-current-ancestor]`. `--tree-item-level` holds the level of the row, to indent it. See [Styling](./styling.md).

## Focus and keys

- The links are in the order of Tab, as the links of a page are.
- A disabled item, by `isDisabled` on it or `disabledKeys` on the tree, has a link that is a `span` with `role="link"`, `aria-disabled` and `data-disabled`, and no `href`. It does not navigate and is not a tab stop, as a disabled [Link](./link.md).
- Up and Down move to the link of the next or the previous row that shows, and Home and End to the first and the last.
- Right opens a closed row. Left closes an open row, or else moves to the row that holds it. Right to left, they turn around.
- Enter follows a link. Letters move to the row whose text starts with them.
