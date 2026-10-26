# Virtualizer

A box that scrolls a long collection, such as thousands of rows, and renders only the rows in view.

```brm demo VirtualizerDemo

```

```html
<Virtualizer rowHeight=(32) style="height: 300px">
  <Tree aria-label="Photos" items=files item=file />
</Virtualizer>
```

- A `Virtualizer` is a box that scrolls. Give it a height. `rowHeight` is the height of a row in pixels, 32 by default.
- A [Tree](./tree.md) in it renders only the rows in view, as the user scrolls. A Tree takes `rowHeight` itself too, in a box of your own that scrolls.
- The server renders the first rows, with spacers for the height of the rest, so the page has its height before its code loads.
- A row that leaves the view keeps its state while it is in the list.

## Other collections

The rows of a [GridList](./grid-list.md), a [ListBox](./list-box.md) or a [Table](./table.md) come from a `#for` of your own. Give it `window(height)`, and it renders only the rows in view, in the box that scrolls:

```html
<Virtualizer style="height: 300px">
  <Table aria-label="Files">
    <TableHeader>…</TableHeader>
    <TableBody>
      #for (file of files by file.id) window(32) {
        <Row id=(file.id)>…</Row>
      }
    </TableBody>
  </Table>
</Virtualizer>
```

See [windowed lists](../docs/control-flow.md#windowed-lists) for how it renders.

## Keyboard

- In a [Tree](./tree.md), the keys read the data of all its rows, not only those that render. Home, End, PageUp and PageDown, Ctrl+A, a range with Shift, Left to the row that holds a row, and letters reach rows that are out of view. A move to a row that is not rendered scrolls it into view, then focuses it.
- Letters match the text of a row that renders, and for the others the text that `getTextValue` of the Tree returns for the item, such as `getTextValue=((file) => file.name)`. Without it, letters match the rows in view only.
- The Tree has `aria-rowcount` with the count of all its rows, and each row `aria-rowindex`, since not all the rows are in the page.
- The rows of the other collections move between the rows that are rendered. A move to the edge of the view scrolls it, and the rows that come into view render, so Up and Down go through the whole list. Home and End go to the first and the last row that are rendered.
