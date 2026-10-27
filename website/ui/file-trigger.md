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

## Styling

A FileTrigger has no data attributes. Style its [Button](./button.md#data-attributes). See [Styling](./styling.md).
