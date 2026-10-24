# ToggleButtonGroup

ToggleButtons with one selection, as radios, or several, as a toolbar.

```brm demo ToggleButtonGroupDemo

```

- Each [ToggleButton](./toggle-button.md) in the group names itself with `id`, and `selectedKeys` is the list of the ones that are on. See [State](./state.md).
- `selectionMode="single"`, the default, makes the group a `radiogroup` of radios. `"multiple"` makes it a toolbar of toggle buttons.
- `disallowEmptySelection` keeps one button on.
- The arrow keys move focus between the buttons, as in a [Toolbar](./toolbar.md).
- Name it with `aria-label` or `aria-labelledby`.
