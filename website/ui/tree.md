# Tree

Rows that nest, open and close, such as the folders and files of a file browser, which the user can select and act on.

```brm demo TreeDemo

```

```html
<Tree aria-label="Files" items=files item=file selectedKeys=$bind(picked) expandedKeys=$bind(open) selectionMode="multiple" />

#template file(file) {
  <TreeItem textValue=(file.name)>
    <Button slot="chevron">▸</Button>
    <Checkbox slot="selection" aria-label=(`Select ${file.name}`) />
    {file.name}
  </TreeItem>
}
```

- A `Tree` takes `items`, each with an `id`, its key. An item with `children` is a parent, even when the array is empty. It needs `aria-label` or `aria-labelledby`.
- `item` is a `#template` that renders a `TreeItem` for an item. Its parameter takes its type from `items`. The Tree renders it for each item that shows, and gives the TreeItem its key and its place in the tree.
- `expandedKeys` holds the keys of the open items, and `onExpandedChange` hears of changes. The children of a closed item do not render.
- Selection is as in a [GridList](./grid-list.md): `selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys` and `onSelectionChange`.
- `rowHeight` renders only the rows in view, as in a [Virtualizer](./virtualizer.md), which gives it too. `getTextValue` returns the text of an item for the letters that move to a row, for the rows out of view.
- `onAction` gets the key of a row that Enter acts on, or a press when nothing is selectable. Without it, and with nothing selectable, Enter and a press open and close a row with children.

## Anatomy

```html
<Tree>
  <TreeItem>
    <Button slot="chevron" />
    <Checkbox slot="selection" />
  </>
</>
```

The Tree renders a `TreeItem` for each item through its `item` template. The `Button` and the `Checkbox` are optional.

## Props

### Tree

```props Tree

```

### TreeItem

```props TreeItem

```

## Data attributes

### TreeItem

| Attribute              | When                                                   |
| ---------------------- | ------------------------------------------------------ |
| `data-expanded`        | The row is open.                                       |
| `data-has-child-items` | The item has `children`, even when the array is empty. |
| `data-level`           | Always. It is the depth of the row, from 1.            |
| `data-selected`        | The row is selected.                                   |
| `data-disabled`        | The row is disabled.                                   |
| `data-pressed`         | A pointer or a key holds it down.                      |
| `data-hovered`         | A mouse or a pen is over it.                           |
| `data-focused`         | It has focus.                                          |
| `data-focus-visible`   | Its focus shows as a ring.                             |

## Keyboard

Right to left, Left and Right turn around.

| Key                      | Action                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `Tab`                    | Moves focus to the tree, at the row that had focus last, else the first selected row, else the first row. |
| `ArrowDown` or `ArrowUp` | Moves to the next or the previous row that shows.                                                         |
| `ArrowRight`             | Opens a closed row. On an open row, moves through the controls in the row.                                |
| `ArrowLeft`              | Closes an open row, else moves to the row that holds it.                                                  |
| `Home` or `End`          | Moves to the first or the last row.                                                                       |
| `PageUp` or `PageDown`   | Moves a page up or down.                                                                                  |
| `Space`                  | Selects the row. With Shift it extends a range.                                                           |
| `Enter`                  | Acts on the row. With no action and nothing selectable, opens or closes the row.                          |
| `Ctrl + A` or `Meta + A` | Selects all the rows that are not disabled, in a multiple selection.                                      |
| `Escape`                 | Clears the selection.                                                                                     |
| `a` to `z`               | Moves to the row whose text starts with what was typed.                                                   |

## Controlled and uncontrolled

`expandedKeys` holds the keys of the open items, and `selectedKeys` the keys of the selected rows. `expandedKeys=(['docs'])` and `selectedKeys=(['a'])` start the tree's own state, and `$bind(signal)` writes your signal. `onExpandedChange` and `onSelectionChange` get the keys after each change. The children of a closed item do not render. See [State](./state.md).

## Styling

Style a row with the data attributes above, such as `[data-expanded]` and `[data-selected]`. `--tree-item-level` holds the level of the row, to indent it. See [Styling](./styling.md).

## Rows

- The Tree is a treegrid, and its rows are flat. Each TreeItem is a row with one cell, with `aria-level`, `aria-posinset` and `aria-setsize`, and `aria-expanded` when it has children. The server renders them all, so the page is right before its code loads.
- A `Button` with `slot="chevron"` opens and closes its row. It is not a tab stop, and its label says Expand or Collapse, with the name of the row.
- A `Checkbox` with `slot="selection"` and no `value` shows whether the row is selected, and toggles it.
- A row shows `data-expanded`, `data-has-child-items`, `data-level`, `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`. Its level is in the `--tree-item-level` CSS variable too, to indent it:

```css
[role='row'] {
  padding-inline-start: calc((var(--tree-item-level) - 1) * 1.25rem);
}
```

## Focus and keys

- Tab stops at the tree once, at the row that had focus last, or else the first selected row, or the first row. Tab from inside the tree leaves it. When the row that has focus leaves the tree, such as when its parent closes from outside, the tree is a stop of Tab again.
- Up and Down move between the rows that show, Home and End go to the first and the last, and PageUp and PageDown move a page. Letters move to the row whose text starts with them. `textValue` sets that text for a row whose content is more than text.
- Right opens a closed row. Left closes an open row, or else moves to the row that holds it. Right to left, they turn around.
- On an open row, or a row with no children, Right and Left move through the controls in the row, and back to the row.
- Space selects the row that has focus, Shift extends a range, Ctrl+A or Cmd+A selects all, and Escape clears the selection.
