# Table

Rows and columns of data, which the user can move through with the keys, select and sort.

```brm demo TableDemo

```

```html
<Table aria-label="Files" selectionMode="multiple" selectedKeys=$bind(picked) sortDescriptor=$bind(sort)>
  <TableHeader>
    <Column><Checkbox slot="selection" aria-label="Select all" /></Column>
    <Column id="name" isRowHeader allowsSorting>Name</Column>
    <Column id="size" allowsSorting>Size</Column>
  </TableHeader>
  <TableBody>
    #for (file of rows by file.id) {
      <Row id=(file.id)>
        <Cell><Checkbox slot="selection" aria-label=(`Select ${file.name}`) /></Cell>
        <Cell>{file.name}</Cell>
        <Cell>{file.size}</Cell>
      </Row>
    }
  </TableBody>
</Table>
```

- A `Table` holds a `TableHeader` of `Column` elements and a `TableBody` of `Row` elements. Each Row has a `Cell` for each Column, in the same order. It needs `aria-label` or `aria-labelledby`.
- A Column with `isRowHeader` makes its cells name their rows. A Table needs one.
- A `Row` has an `id`, its key. Selection is as in a [GridList](./grid-list.md), on the rows: `selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys` and `onSelectionChange`.
- A `Checkbox` with `slot="selection"` in a Cell shows whether its row is selected, and toggles it. One in a Column selects every row, or none, and shows a mixed state while some are selected.
- `onRowAction` gets the key of a row that Enter acts on, or a press when nothing is selectable.

## Sorting

A Column with an `id` and `allowsSorting` sorts the table on a press, or Enter. `sortDescriptor` holds the column and the direction, `{ column, direction }`, and `onSortChange` hears of changes. A press sorts ascending, then descending. The Table does not reorder the rows: sort them by `sortDescriptor`, as the demo does.

A sortable Column shows `aria-sort`, `data-allows-sorting` and `data-sort-direction`, which can draw an arrow:

```css
[data-sort-direction='ascending']::after { content: ' ▲'; }
[data-sort-direction='descending']::after { content: ' ▼'; }
```

## Elements

The Table renders a `table` with `role="grid"`, a `thead` and a `tbody` with `role="rowgroup"`, and `tr` rows. A Column is a `th` with `role="columnheader"`. A Cell is a `td` with `role="gridcell"`, or a `th` with `role="rowheader"` in the row header column. A Row shows the states of a GridListItem, and a Column shows `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.

## Keyboard

- Tab stops at the table once, at the row or the cell that had focus last, or else the first selected row, or the first row. Tab from inside the table leaves it.
- Up and Down move between rows, and from a cell to the cell of the same column in the row above or below. Up from the first row goes to the column headers, and Down from a header to its column in the first row.
- Right from a row goes to its first cell, then along the cells, then back to the row. Left goes the other way. Right to left, they turn around. On the column headers, they move between the columns, round the ends.
- A cell with a control, such as a Checkbox or a Button, gives the focus to the control.
- Home and End go to the first and the last row, or to the first and the last cell of the row. With Ctrl or Cmd on a cell, they go to the first cell of the first row, or the last cell of the last row.
- Space selects the row, Shift extends a range, Ctrl+A or Cmd+A selects all, and Escape clears the selection. Letters move to the row whose text starts with them.
