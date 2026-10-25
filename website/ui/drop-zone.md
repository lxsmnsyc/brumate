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
- `getDropOperation(types, allowed)` gets the types of a drag, and returns `'cancel'` to refuse it. Files show as their types, such as `image/png`.
- `isDisabled` refuses every drop.
- A [FileTrigger](./file-trigger.md) in it picks files from the device, for users who do not drag.

## Keyboard and screen readers

- A hidden button in the area takes the focus. A click on the area, not on a control in it, focuses it.
- A paste on the button drops the text or files of the clipboard.
- A `Text` with `slot="label"` names the button. `aria-label` names it too, "DropZone" by default.

## Styles

| Attribute            | When                                    |
| -------------------- | --------------------------------------- |
| `data-drop-target`   | A drag that it takes is over it.        |
| `data-hovered`       | The pointer is over it.                 |
| `data-focused`       | Its button has the focus.               |
| `data-focus-visible` | Its button has the focus from the keys. |
| `data-disabled`      | It refuses drops.                       |

Drops need scripts. The server renders the area and its label.
