# GridList

A list of rows that can hold buttons, checkboxes and links, which the user can select and act on.

```brm demo GridListDemo

```

```html
<GridList aria-label="Files" selectionMode="multiple" selectedKeys=$bind(picked)>
  #for (file of files by file) {
    <GridListItem id=file textValue=file>
      <Checkbox slot="selection" aria-label=(`Select ${file}`) />
      {file}
      <Button onPress=(() => open(file))>Open</Button>
    </GridListItem>
  }
</GridList>
```

- A `GridList` holds `GridListItem` elements, each with an `id`, its key. It needs `aria-label` or `aria-labelledby`.
- A GridList can take `items`, each with an `id`, and an `item` template that renders a `GridListItem` for each, as a [Tree](./tree.md) does. With `rowHeight`, or in a [Virtualizer](./virtualizer.md), it renders only the rows in view, and its keys read the data of all the items. `getTextValue` returns the text of an item for the letters that move to a row, for the rows out of view.
- Selection is as in a [ListBox](./list-box.md): `selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys` and `onSelectionChange`.
- A `Checkbox` with `slot="selection"` and no `value` in a row shows whether the row is selected, and toggles it.
- `onAction` gets the key of a row that Enter acts on, or a press when nothing is selectable. `onAction` on a row runs too.

## Keyboard

- Tab stops at the list once, at the row that had focus last, or else the first selected row, or the first row. Tab from inside the list leaves it.
- Up and Down move between rows, and Home and End go to the first and the last row. Letters move to the row whose text starts with them. `textValue` sets that text for a row whose content is more than text.
- Left and Right move through the controls in a row, and back to the row. Right to left, they turn around.
- Space selects the row that has focus, and Shift extends a range from it. Ctrl+A or Cmd+A selects all but the disabled rows, and Escape clears the selection, also from a control in a row.
- PageUp and PageDown move by the height of the list.
- With `items` in a windowed list, Home, End, the page keys, Ctrl+A, ranges with Shift and letters reach rows that are out of view. A move to one scrolls it into view, then focuses it.
- A text field in a row keeps its own keys, other than Up, Down and Tab.

## Rows

The GridList is a grid, and each GridListItem is a row with one cell, as in React Aria. A press on a control in a row, such as a Button, is the control's own, and does not select the row. A row shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.

## Drag and drop

Rows drag to new places with `onReorder`, and out of the list, such as to a [DropZone](./drop-zone.md), with `getItems`.

```html
<GridList aria-label="Files" onReorder=reorder getItems=((keys) => keys.map((key) => ({ 'text/plain': key })))>
  #for (file of files by file) {
    <GridListItem id=file textValue=file>
      <Button slot="drag">≡</Button>
      {file}
    </GridListItem>
  }
</GridList>
```

- `onReorder` gets `keys`, the rows that move, and `target`, with the `key` of a row and a `dropPosition` of `before` or `after`. `moveKeys` of the [data helpers](./data.md), or `moveBefore` and `moveAfter` of `listData`, move them.
- `getItems` gets the keys of the rows that a drag moves, in the order of the list, and returns the data of each row, as a string for each type, such as `text/plain`. With no `getItems`, the data is the keys as text. A [DropZone](./drop-zone.md) gets one item for each row. Other targets get the text of each type joined with new lines.
- A drop on a row that moves, in a gap of the list, or that leaves the order as it is does not call `onReorder`. A drag that the list did not start, such as a file, is not taken.
- A drag takes the selected rows when the dragged row is selected, and else that row.
- A row shows `data-dragging` while a drag moves it, and `data-drop-target`, `before` or `after`, while a drag would drop by it.

From the keys:

- A `Button` with `slot="drag"` in a row starts a drag. Its label is "Drag" and the `textValue` of the row. It works with `onReorder` only, and is disabled with `getItems` alone, since a drag from the keys needs a place to drop in the list.
- Up and Down choose where the rows go. The row by that place takes the focus.
- Enter drops. Escape and Tab cancel, and so does focus leaving the list.
- A live region says what happens, for screen readers.
