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
- A Table can take `items`, each with an `id`, and its `TableBody` an `item` template that renders a `Row` for each, as a [Tree](./tree.md) does. With `rowHeight`, or in a [Virtualizer](./virtualizer.md), it renders only the rows in view, and its keys read the data of all the items. `getTextValue` returns the text of an item for the letters that move to a row, for the rows out of view.
- A `Row` has an `id`, its key. Selection is as in a [GridList](./grid-list.md), on the rows: `selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys` and `onSelectionChange`.
- A `Checkbox` with `slot="selection"` in a Cell shows whether its row is selected, and toggles it. One in a Column selects every row, or none, and shows a mixed state while some are selected. The browser counts the rows that can be selected when the page loads, so the box is right from then on, and as rows come and go.
- `onRowAction` gets the key of a row that Enter acts on, or a press when nothing is selectable.

## Anatomy

```brm anatomy TableAnatomy
`ResizableTableContainer`: Lets the columns resize and scrolls a Table that is wider than it.
`Table`: Holds the header and the body. It is named by `aria-label` or `aria-labelledby`.
`TableHeader`: Holds the columns.
`Column`: A header cell. It sorts when it has `allowsSorting`.
`Checkbox` with `slot="selection"`: In a Column, selects every row.
`ColumnResizer`: Resizes its column with a drag or the keys.
`TableBody`: Holds the rows.
`Row`: One item. Its `id` is its key.
`Cell`: One value of a row, in the order of the columns.
`Checkbox` with `slot="selection"`: In a Cell, selects its row.
```

```html
<ResizableTableContainer>
  <Table>
    <TableHeader>
      <Column>
        <Checkbox slot="selection" />
        <ColumnResizer />
      </>
    </>
    <TableBody>
      <Row>
        <Cell>
          <Checkbox slot="selection" />
        </>
      </>
    </>
  </>
</>
```

The picture marks the pieces of a table through elements of its own, since a table, a row, a cell and a header cannot carry a number. The 3 sits on the text of the Name header, the 6 at the end of that column, the 7 on the text of the Kind cell of the first row, the 8 on a cell of the second row, and the 9 on the Name cell of the first row. The `ResizableTableContainer`, the `ColumnResizer` and the Checkbox elements with `slot="selection"` are optional. A Row has a Cell for each Column.

## Props

### Table

```props Table

```

### TableHeader

```props TableHeader

```

### Column

```props Column

```

### TableBody

```props TableBody

```

### Row

```props Row

```

### Cell

```props Cell

```

### ResizableTableContainer

```props ResizableTableContainer

```

### ColumnResizer

```props ColumnResizer

```

## Data attributes

### Table

| Attribute        | When                                         |
| ---------------- | -------------------------------------------- |
| `data-resizable` | The Table is in a `ResizableTableContainer`. |

### Column

| Attribute             | When                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `data-allows-sorting` | The column has `allowsSorting`.                                  |
| `data-sort-direction` | The table is sorted by this column, `ascending` or `descending`. |
| `data-resizing`       | A resizer is moving the column.                                  |
| `data-pressed`        | A pointer or a key holds it down.                                |
| `data-hovered`        | A mouse or a pen is over it.                                     |
| `data-focused`        | It has focus.                                                    |
| `data-focus-visible`  | Its focus shows as a ring.                                       |

### Row

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The row is selected.              |
| `data-disabled`      | The row is disabled.              |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | It has focus.                     |
| `data-focus-visible` | Its focus shows as a ring.        |

### ColumnResizer

| Attribute                  | When                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `data-resizing`            | A drag or the keys are resizing the column.                                                                   |
| `data-resizable-direction` | `both` by default, `left` at the least width and `right` at the most. Right to left, `left` and `right` swap. |
| `data-hovered`             | A mouse or a pen is over it.                                                                                  |
| `data-focused`             | It has focus.                                                                                                 |
| `data-focus-visible`       | Its focus shows as a ring.                                                                                    |

## Keyboard

Right to left, Left and Right turn around.

| Key                                           | Action                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                                         | Moves focus to the table, at the row or the cell that had focus last, else the first selected row, else the first row.                |
| `ArrowDown` or `ArrowUp`                      | Moves to the next or the previous row, or to the cell of the same column in it. Up from the first row goes to the column headers.     |
| `ArrowRight` or `ArrowLeft`                   | Moves from a row to its cells, along them, and back to the row. On the column headers, moves between the columns.                     |
| `PageUp` or `PageDown`                        | Moves a page of rows up or down, keeping the column of a cell. On a column header, `PageDown` goes to the first row.                  |
| `Home` or `End`                               | Moves to the first or the last row, or to the first or the last cell of the row. On a column header, to the first or the last column. |
| `Ctrl + Home` or `Ctrl + End`, or with `Meta` | On a cell, moves to the first cell of the first row, or the last cell of the last row.                                                |
| `Space`                                       | Selects the row. With Shift it extends a range. On a sortable column header, sorts the column.                                        |
| `Enter`                                       | Acts on the row, or sorts the column that has focus.                                                                                  |
| `Ctrl + A` or `Meta + A`                      | Selects all the rows that are not disabled.                                                                                           |
| `Escape`                                      | Clears the selection, unless `disallowEmptySelection`.                                                                                |
| `a` to `z`                                    | Moves focus to the row whose text starts with what was typed.                                                                         |

## Controlled and uncontrolled

`selectedKeys` holds the keys of the selected rows, and `sortDescriptor` holds the sort, `{ column, direction }`. `selectedKeys=(['a'])` and `sortDescriptor=({ column: 'name', direction: 'ascending' })` start the table's own state, and `$bind(signal)` writes your signal. `onSelectionChange` and `onSortChange` get each change. The Table does not reorder the rows: sort them by `sortDescriptor`. See [State](./state.md).

```brm demo TableStateDemo

```

- Own state: `selectedKeys=(['Ada'])` is where the selection starts. The first table keeps it, and the page does not see it.
- `$bind(signal)` writes your signal on each change, and a write from code, such as the first button, changes the selection. The same holds for `sortDescriptor`, with the second button.
- `$bind(signal, request)` asks you first. The third table takes one row at most: a second row calls `request`, which leaves the signal as it is, and the selection stays.
- A sort does not move the rows. The last table reorders them from its signal.
- A Table is not a form field. It has no `name` and no reset, so a reset of a form leaves its selection and sort as they are. The server renders the selection it starts with, and the rows it has.

## Styling

Style a row with the data attributes above, such as `[data-selected]`, and a column with `[data-sort-direction]`. A resizer shows `[data-resizing]`. See [Styling](./styling.md).

This stylesheet styles a header at rest, on hover, on press and with keyboard focus, the arrow of the sorted column, the resizer, the rows (hover, selected, keyboard focus, disabled) and the Checkbox. Its tokens are at the top, and they follow the color scheme. Press a header to sort, drag the edge of Name, or use Tab and the arrow keys. Linus is disabled.

```brm styled TableStyled

```

## Use cases

### Actions on the selected rows

Keep the rows in a signal and `selectedKeys` in another. A button reads the keys and changes the rows. A `$memo` can total the selected rows. After the action, clear the selection, since the keys of removed rows would stay in it.

```brm demo TableBulkDemo

```

### A long table

Pass `items` to the Table and an `item` template to its `TableBody`, and put the Table in a [Virtualizer](./virtualizer.md). It renders about twenty rows of 3000, and sorting by `sortDescriptor` orders all of them. Press a header, then End to reach the last row.

```brm demo TableLargeDemo

```

## Rows from data

Pass `items` to the Table and an `item` template to its `TableBody`. The TableBody does not get the type of the items from the Table, so give the template's parameter a type, such as `item: File`.

```html
<Table aria-label="Files" items=files>
  <TableHeader>…</TableHeader>
  <TableBody item=row />
</Table>

#template row(item: File) {
  <Row id=(item.id)>
    <Cell>{item.name}</Cell>
  </Row>
}
```

## Sorting

A Column with an `id` and `allowsSorting` sorts the table on a press, or Enter. `sortDescriptor` holds the column and the direction, `{ column, direction }`, and `onSortChange` hears of changes. A press sorts ascending, then descending. The Table does not reorder the rows: sort them by `sortDescriptor`, as the demo does.

A sortable Column shows `aria-sort`, `data-allows-sorting` and `data-sort-direction`, which can draw an arrow:

```css
[data-sort-direction='ascending']::after { content: ' ▲'; }
[data-sort-direction='descending']::after { content: ' ▼'; }
```

## Elements

The Table renders a `table` with `role="grid"`, a `thead` and a `tbody` with `role="rowgroup"`, and `tr` rows. A Column is a `th` with `role="columnheader"`. A Cell is a `td` with `role="gridcell"`, or a `th` with `role="rowheader"` in the row header column. A Row shows the states of a GridListItem, and a Column shows `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.

## Focus and keys

- Tab stops at the table once, at the row or the cell that had focus last, or else the first selected row, or the first row. Tab from inside the table leaves it.
- Up and Down move between rows, and from a cell to the cell of the same column in the row above or below. Up from the first row goes to the column headers, and Down from a header to its column in the first row.
- Right from a row goes to its first cell, then along the cells, then back to the row. Left goes the other way. Right to left, they turn around. On the column headers, they move between the columns, round the ends.
- A cell with a control, such as a Checkbox or a Button, gives the focus to the control.
- Page Up and Page Down move up and down a page of rows, keeping the column of a cell.
- Home and End go to the first and the last row, or to the first and the last cell of the row. With Ctrl or Cmd on a cell, they go to the first cell of the first row, or the last cell of the last row.
- With `items` in a windowed table, Home, End, the page keys, Ctrl+A, the box in the header, ranges with Shift and letters reach rows that are out of view. A move to one scrolls it into view, then focuses it.
- Space selects the row, Shift extends a range, also with the arrow keys from the row that has focus, Ctrl+A or Cmd+A selects all the rows that are not disabled, and Escape clears the selection. A table with `disallowEmptySelection` keeps its selection against Escape and the box in the header. Letters move to the row whose text starts with them.

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
- A `ColumnResizer` in a Column resizes it with a drag. When a resize starts, every column keeps its width in pixels, and the Table is as wide as its columns.
- `onResize` hears of the widths while a resizer moves, and `onResizeEnd` when it stops, as a `Map` from the key of a column to its width.
- The resizer holds a hidden range input, which a screen reader reads as the width in pixels. Its value is the width of the column, and a change of it from assistive technology sets the width.
- A Column that sorts or has a resizer takes the focus itself first, and Enter or Space sorts it. Left and Right then move through its controls, such as the resizer, before they move to the next column.
- On the input, Enter starts a resize, the arrow keys change the width by 10 pixels, and Escape, Enter, Space, Tab or a blur end it.
- A resizer shows `data-resizing`, `data-resizable-direction`, which is `both` by default, `left` at the least width and `right` at the most (swapped right to left), `data-hovered`, `data-focused` and `data-focus-visible`. A Column shows `data-resizing` while it resizes.
