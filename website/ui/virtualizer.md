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

## Anatomy

```html
<Virtualizer>
  <Tree />
</>
```

A Tree, a GridList, a ListBox or a Table goes inside.

## Props

```props Virtualizer

```

## Data attributes

| Attribute          | When                      |
| ------------------ | ------------------------- |
| `data-virtualizer` | Always. It marks the box. |

## Keyboard

A Virtualizer takes no keys. The collection inside does, and its keys reach rows that are out of view. See [Focus and keys](#focus-and-keys).

## Styling

The Virtualizer is a `div` with `overflow: auto`. Give it a `height`, such as `style="height: 300px"`. See [Styling](./styling.md).

## Other collections

A [GridList](./grid-list.md), a [ListBox](./list-box.md) or a [Table](./table.md) takes `items`, as a Tree does, and renders only the rows in view when it is in a Virtualizer:

```html
<Virtualizer rowHeight=(32) style="height: 300px">
  <ListBox aria-label="Files" items=files item=file getTextValue=((file) => file.name) />
</Virtualizer>
```

A Table takes `items` and `getTextValue`, and its `TableBody` takes `item`. A template parameter takes a type, such as `file: File`. Their keys read the data, as the keyboard section says.

Rows that you write out or render from a `#for` of your own have no data to read. Give the `#for` `window(height)`, and it renders only the rows in view, in the box that scrolls:

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

## Focus and keys

- In a [Tree](./tree.md), and in a GridList, a ListBox or a Table that has `items`, the keys read the data of all the rows, not only those that render. Home, End, PageUp and PageDown, Ctrl+A, a range with Shift, and letters reach rows that are out of view. In a Tree, Left reaches the row that holds a row. A move to a row that is not rendered scrolls it into view, then focuses it.
- In a Table, the box in the header selects every row that can be selected, also those that are not rendered.
- Letters match the text of a row that renders, and for the others the text that `getTextValue` returns for the item, such as `getTextValue=((file) => file.name)`. Without it, letters match the rows in view only.
- The Tree has `aria-rowcount` with the count of all its rows, and each row `aria-rowindex`, since not all the rows are in the page. The other collections do not have them yet.
- A ListBox windows a vertical list that no field filters, so a ListBox in a ComboBox renders all its items. A GridList windowed with `onReorder` drags only between the rows that render.
- The rows of a collection that has no `items` move between the rows that are rendered. A move to the edge of the view scrolls it, and the rows that come into view render, so Up and Down go through the whole list. Home and End go to the first and the last row that are rendered.
