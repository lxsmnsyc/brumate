# FileTrigger

Opens the file picker of the browser from a `Button` inside it.

```brm demo FileTriggerDemo

```

- `onSelect` gets the files that the user picked.
- `acceptedFileTypes`, `allowsMultiple`, `defaultCamera` and `acceptDirectory` set the input.
- The input is hidden, so the picker needs scripts. For a form that must work without them, use a visible `<input type="file">`.
