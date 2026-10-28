# DropZone

An area that takes drops of text and files, and pastes from keyboard users.

```brm demo DropZoneDemo

```

```html
<DropZone onDrop=dropped>
  <Text slot="label">Drop files here</Text>
</DropZone>
```

- `onDrop` gets the items of a drop. A text item has `types` and `getText(type)`. A file item has `name`, `type` and `getFile()`.
- `onDropEnter` and `onDropExit` run as a drag that it takes comes over it and leaves.
- `getDropOperation(types, allowed)` gets the types of a drag and the operations its source allows, and returns one of them, or `'cancel'` to refuse it. Files show as their types, such as `image/png`. Without it, the first allowed operation is used. A drag shows `data-drop-target` only for an allowed operation.
- A drag of the rows of a [GridList](./grid-list.md) gives one item for each row.
- `isDisabled` refuses every drop.
- A [FileTrigger](./file-trigger.md) in it picks files from the device, for users who do not drag.

## Anatomy

```brm anatomy DropZoneAnatomy
`DropZone`: The area that takes drops. It holds a hidden button for keyboard focus and paste.
`Text` with `slot="label"`: Names the hidden button. Optional.
`Button`: Opens the file picker of the FileTrigger around it. Optional.
```

The FileTrigger draws no element, so it has no number. The hidden button of the area is out of sight, so it has none either.

```html
<DropZone>
  <Text slot="label" />
  <FileTrigger>
    <Button />
  </>
</>
```

The `Text` and the `FileTrigger` are optional.

## Props

```props DropZone

```

## Data attributes

| Attribute            | When                                    |
| -------------------- | --------------------------------------- |
| `data-drop-target`   | A drag that it takes is over it.        |
| `data-hovered`       | The pointer is over it.                 |
| `data-focused`       | Its button has the focus.               |
| `data-focus-visible` | Its button has the focus from the keys. |
| `data-disabled`      | It refuses drops.                       |

Drops need scripts. The server renders the area and its label.

## Keyboard

A hidden button in the area takes the focus. A click on the area, not on a control in it, focuses it.

| Key                      | Action                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| `Tab`                    | Moves focus to the hidden button.                                               |
| `Ctrl + V` or `Meta + V` | Pastes the text or files of the clipboard as a drop, with the `copy` operation. |

A `Text` with `slot="label"` names the button. `aria-label` names it too, "DropZone" by default.

## Controlled and uncontrolled

A DropZone keeps no value. It tells the page what was dropped with `onDrop`, and whether a drag is over it with `onDropEnter` and `onDropExit`. The page keeps the items in its own state, as the demos below do. See [State](./state.md).

## Styling

Style the area with the data attributes above, such as `[data-drop-target]` for a drag over it. See [Styling](./styling.md).

This stylesheet styles rest, hover, a drag over the area, keyboard focus and disabled. Drag a file over the first area, tab to it, or look at the second.

```brm styled DropZoneStyled

```

## Use cases

### Images only

`getDropOperation` looks at the types of the drag and returns `'cancel'` when none is an image, so the area shows no drop target for other files and the drop does nothing. The label follows `onDropEnter` and `onDropExit`. The Browse button picks images from the device for users who do not drag.

```brm demo DropZoneImagesDemo

```

### Text snippets

A text item gives its text with `getText('text/plain')`. Select text on the page and drag it here. A keyboard user focuses the area and pastes, which drops the text of the clipboard with the `copy` operation.

```brm demo DropZoneNotesDemo

```
