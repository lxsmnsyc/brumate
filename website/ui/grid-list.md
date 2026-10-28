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

## Anatomy

```brm anatomy GridListAnatomy
`GridList`: Holds the rows and the selection. It is a `grid`, takes one stop of Tab, and needs `aria-label`.
`GridListItem`: One row, with one cell. Its `id` is its key, and it shows `data-selected` when it is selected.
`Checkbox` with `slot="selection"`: Shows whether the row is selected, and toggles it. Optional.
`Button` with `slot="drag"`: Starts a drag of the row from the keys. It needs `onReorder`. Optional.
`Button`: Any other control in the row. Its press is its own and does not select the row.
```

```html
<GridList>
  <GridListItem>
    <Checkbox slot="selection" />
    <Button slot="drag" />
    <Button />
  </>
</>
```

The Checkbox with `slot="selection"` and the Button with `slot="drag"` are optional, and a row can hold any other control.

## Props

### GridList

```props GridList

```

### GridListItem

```props GridListItem

```

## Data attributes

### GridList

| Attribute       | When                               |
| --------------- | ---------------------------------- |
| `data-dragging` | A drag is moving rows of the list. |

### GridListItem

| Attribute            | When                                               |
| -------------------- | -------------------------------------------------- |
| `data-selected`      | The row is selected.                               |
| `data-disabled`      | The row is disabled.                               |
| `data-pressed`       | A pointer or a key holds it down.                  |
| `data-hovered`       | A mouse or a pen is over it.                       |
| `data-focused`       | It has focus.                                      |
| `data-focus-visible` | Its focus shows as a ring.                         |
| `data-dragging`      | A drag is moving it.                               |
| `data-drop-target`   | A drag would drop by it, with `before` or `after`. |

## Keyboard

| Key                         | Action                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the list, at the row that had focus last, else the first selected row, else the first row. |
| `ArrowDown` or `ArrowUp`    | Moves focus to the next or the previous row.                                                              |
| `ArrowRight` or `ArrowLeft` | Moves focus through the controls in the row, and back to the row. Right to left, they turn around.        |
| `Home` or `End`             | Moves focus to the first or the last row.                                                                 |
| `PageUp` or `PageDown`      | Moves focus by the height of the list.                                                                    |
| `Space`                     | Selects the row. With Shift it extends a range.                                                           |
| `Enter`                     | Acts on the row.                                                                                          |
| `Ctrl + A` or `Meta + A`    | Selects all the rows that are not disabled.                                                               |
| `Escape`                    | Clears the selection, also from a control in a row.                                                       |
| `a` to `z`                  | Moves focus to the row whose text starts with what was typed.                                             |

## Drag from the keys

With `onReorder`, the Button with `slot="drag"` starts a drag from the keys. Then the keys act on the drag.

| Key                      | Action                                                |
| ------------------------ | ----------------------------------------------------- |
| `ArrowDown` or `ArrowUp` | Moves the drop place to the next or the previous one. |
| `Enter`                  | Drops the rows at the place.                          |
| `Escape` or `Tab`        | Cancels the drag.                                     |

## Controlled and uncontrolled

`selectedKeys` holds the keys of the selected rows, as a list. How you pass it picks who keeps it:

```brm demo GridListStateDemo

```

- `selectedKeys` alone, or nothing, makes the list keep its own selection. `selectedKeys=(['cat'])` is where that selection starts. Pick another row and the list keeps the pick. A new value from you replaces it.
- `selectedKeys=$bind(signal)` writes your signal. Change the signal and the list follows.
- `selectedKeys=$bind(signal, (next) => ...)` asks you first. The list shows what you keep, so a request that you ignore leaves the old keys. Press Lock above and pick a row in the last list.
- `onSelectionChange` gets the keys after each change, in every shape.
- A GridList is not a form field. It has no `name` and no reset, so a reset of a form leaves its selection as it is. The server renders the selection it starts with. See [State](./state.md).

## Styling

Style a row with the data attributes above, such as `[data-selected]` and `[data-drop-target]`. The Checkbox and the Buttons in a row show their own attributes. See [Styling](./styling.md).

This stylesheet styles every state of a row: rest, hover, press, keyboard focus, selected, selected and hovered, selected and pressed, and disabled, with the Checkbox and the Button in it. Its tokens are at the top, and they follow the color scheme. Tab to the list, press the arrow keys and Space, then Right to reach the Button.

```brm styled GridListStyled

```

## Use cases

### Rows with actions on the selection

A Checkbox with `slot="selection"` selects a row, and a Button in the row acts on that row alone. The button above the list acts on the selected rows. Both remove keys from the data. The GridList keeps the keys that you give it, so the demo also drops them from the bound selection, and the signal keeps no key of a row that is gone. A press on a row's button ignores a second press for a moment, since the next row moves under the pointer.

```brm demo GridListBulkDemo

```

### A playlist that reorders

With no `selectionMode`, a press or Enter on a row acts: `onAction` gets its key. `onReorder` lets the rows move, by a pointer drag or from the keys with the Button of `slot="drag"`: press it, choose the place with Up and Down, and drop with Enter. `moveKeys` of the [data helpers](./data.md) moves the keys in the list of your data.

```brm demo GridListPlaylistDemo

```

## Rows from data

Pass `items` and an `item` template that renders a `GridListItem` for each. The template's parameter takes its type from `items`.

```html
<GridList aria-label="Files" items=files item=row />

#template row(item) {
  <GridListItem id=(item.id) textValue=(item.name)>{item.name}</GridListItem>
}
```

## Focus and keys

- Tab stops at the list once, at the row that had focus last, or else the first selected row, or the first row. Tab from inside the list leaves it.
- Up and Down move between rows, and Home and End go to the first and the last row. Letters move to the row whose text starts with them. `textValue` sets that text for a row whose content is more than text.
- Left and Right move through the controls in a row, and back to the row. Right to left, they turn around.
- Space selects the row that has focus, and Shift extends a range from it. Ctrl+A or Cmd+A selects all but the disabled rows, and Escape clears the selection, also from a control in a row.
- PageUp and PageDown move by the height of the list.
- With `items` in a windowed list, Home, End, the page keys, Ctrl+A, ranges with Shift and letters reach rows that are out of view. A move to one scrolls it into view, then focuses it.
- A text field in a row keeps its own keys, other than Up, Down and Tab.

## Rows

The GridList is a grid, and each GridListItem is a row with one cell. A press on a control in a row, such as a Button, is the control's own, and does not select the row. A row shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.

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
