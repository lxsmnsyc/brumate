# FileTrigger

Opens the file picker of the browser from a `Button` inside it.

```brm demo FileTriggerDemo

```

- `onSelect` gets the files that the user picked.
- `acceptedFileTypes`, `allowsMultiple`, `defaultCamera` and `acceptDirectory` set the input.
- The input is hidden, so the picker needs scripts. For a form that must work without them, use a visible `<input type="file">`.

## Anatomy

```html
<FileTrigger>
  <Button />
</>
```

The trigger gives the `Button` inside it the press that opens the picker.

## Props

```props FileTrigger

```

## Keyboard

A FileTrigger renders no element of its own, so its keys are those of its [Button](./button.md#keyboard).

| Key                | Action                                |
| ------------------ | ------------------------------------- |
| `Tab`              | Moves focus to the button.            |
| `Enter` or `Space` | Opens the file picker of the browser. |

## Controlled and uncontrolled

A FileTrigger keeps no value. `onSelect` gets the `FileList` of the picker, or `null`, each time the user picks, and the page keeps the files in its own state. Choosing again replaces the pick of the input, and `onSelect` runs again. The trigger has no `isDisabled`: disable the [Button](./button.md) inside it. See [State](./state.md). The trigger draws no element, so this page has no anatomy picture.

## Styling

A FileTrigger has no data attributes. Style its [Button](./button.md#data-attributes). See [Styling](./styling.md).

This stylesheet styles the Button of a trigger: a dashed edge at rest that turns solid on hover, the press, keyboard focus and disabled.

```brm styled FileTriggerStyled

```

## Use cases

### A list of files

`allowsMultiple` lets the picker take several files. The page copies the name and the size of each into a signal, since a signal holds data and not `File` objects, and a press on Remove drops one.

```brm demo FileTriggerListDemo

```

### A photo with a preview

`acceptedFileTypes` limits what the picker offers. The page makes an object URL for the first file and shows it in an `img`. It frees the old URL before it makes another.

```brm demo FileTriggerPreviewDemo

```
