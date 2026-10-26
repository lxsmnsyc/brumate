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
- Selection is as in a [ListBox](./list-box.md): `selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys` and `onSelectionChange`.
- A `Checkbox` with `slot="selection"` and no `value` in a row shows whether the row is selected, and toggles it.
- `onAction` gets the key of a row that Enter acts on, or a press when nothing is selectable. `onAction` on a row runs too.

## Keyboard

- Tab stops at the list once, at the row that had focus last, or else the first selected row, or the first row. Tab from inside the list leaves it.
- Up and Down move between rows, and Home and End go to the first and the last row. Letters move to the row whose text starts with them. `textValue` sets that text for a row whose content is more than text.
- Left and Right move through the controls in a row, and back to the row. Right to left, they turn around.
- Space selects the row that has focus, and Shift extends a range from it. Ctrl+A or Cmd+A selects all but the disabled rows, and Escape clears the selection, also from a control in a row.
- PageUp and PageDown move by the height of the list.
- A text field in a row keeps its own keys, other than Up, Down and Tab.

## Rows

The GridList is a grid, and each GridListItem is a row with one cell, as in React Aria. A press on a control in a row, such as a Button, is the control's own, and does not select the row. A row shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.
