---
'@brumate/ui': minor
---

`GridList`, `ListBox` and `Table` take `items`, as `Tree` does, and render each with an `item` template. With `rowHeight`, or in a `Virtualizer`, they render only the rows in view, and their keys read the data of all the items. Home, End, the page keys, Ctrl+A, the box in the header of a `Table`, ranges with Shift and letters reach rows that are out of view, and a move to one scrolls it into view, then focuses it. `getTextValue` gives the text of an item for letters.
