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
- A `Checkbox` with `slot="selection"` in a Cell shows whether its row is selected, and toggles it. One in a Column selects every row, or none, and shows a mixed state while some are selected. The browser counts the rows that can be selected when the page loads, so the box is right from then on, and as rows come and go.
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
- Page Up and Page Down move up and down a page of rows, keeping the column of a cell.
- Home and End go to the first and the last row, or to the first and the last cell of the row. With Ctrl or Cmd on a cell, they go to the first cell of the first row, or the last cell of the last row.
- Space selects the row, Shift extends a range, Ctrl+A or Cmd+A selects all the rows that are not disabled, and Escape clears the selection. A table with `disallowEmptySelection` keeps its selection against Escape and the box in the header. Letters move to the row whose text starts with them.

## Column resizing

```brm demo TableResizeDemo

```

```html
<ResizableTableContainer onResize=saveWidths>
  <Table aria-label="Files">
    <TableHeader>
      <Column id="name" isRowHeader defaultWidth=(160) minWidth=(100)>
        <span tabindex="-1">Name</span>
        <ColumnResizer />
      </Column>
      <Column id="kind">Kind</Column>
    </TableHeader>
    …
  </Table>
</ResizableTableContainer>
```

- A `ResizableTableContainer` around a Table lets its columns resize. It scrolls the Table when the Table is wider than it.
- In it, a Column takes `width` or `defaultWidth`, in pixels, a percentage, or `'1fr'`, which shares the width that is left with the other columns. `minWidth` and `maxWidth` bound it, in pixels.
- A `ColumnResizer` in a Column resizes it with a drag. When a resize starts, every column keeps its width in pixels, as in React Aria, and the Table is as wide as its columns.
- `onResize` hears of the widths while a resizer moves, and `onResizeEnd` when it stops, as a `Map` from the key of a column to its width.
- The resizer holds a hidden range input, which a screen reader reads as the width in pixels. Its value is the width of the column, and a change of it from assistive technology sets the width.
- A Column that sorts or has a resizer takes the focus itself first, and Enter or Space sorts it. Left and Right then move through its controls, such as the resizer, before they move to the next column.
- On the input, Enter starts a resize, the arrow keys change the width by 10 pixels, and Escape, Enter, Space, Tab or a blur end it.
- A resizer shows `data-resizing`, `data-resizable-direction`, which is `left` at the least width and `right` at the most, `data-hovered`, `data-focused` and `data-focus-visible`. A Column shows `data-resizing` while it resizes.
