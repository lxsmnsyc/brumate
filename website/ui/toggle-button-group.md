# ToggleButtonGroup

ToggleButtons with one selection, as radios, or several, as a toolbar.

```brm demo ToggleButtonGroupDemo

```

- Each [ToggleButton](./toggle-button.md) in the group names itself with `id`, and `selectedKeys` is the list of the ones that are on. See [State](./state.md).
- `selectionMode="single"`, the default, makes the group a `radiogroup` of radios. `"multiple"` makes it a toolbar of toggle buttons, or a `group` inside a [Toolbar](./toolbar.md).
- `disallowEmptySelection` keeps one button on.
- Name it with `aria-label` or `aria-labelledby`.

## Anatomy

```html
<ToggleButtonGroup>
  <ToggleButton />
</>
```

A group holds one or more ToggleButtons.

## Props

### ToggleButtonGroup

```props ToggleButtonGroup

```

### ToggleButton

A button in a group sets `id`. See the [ToggleButton](./toggle-button.md#props) page for its props.

## Data attributes

| Attribute                       | When                         |
| ------------------------------- | ---------------------------- |
| `data-orientation="horizontal"` | The buttons lie in a row.    |
| `data-orientation="vertical"`   | The buttons lie in a column. |
| `data-disabled`                 | The group is disabled.       |

The buttons show [their own attributes](./toggle-button.md#data-attributes).

## Keyboard

Only one button of the group is in the order of Tab. It is the one that had focus last.

| Key                         | Action                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus into the group, to the button that had focus last.                                                                                            |
| `ArrowRight` or `ArrowLeft` | Moves focus to the next or previous button of a horizontal group. Right to left, the keys turn around.                                                    |
| `ArrowDown` or `ArrowUp`    | Moves focus to the next or previous button of a vertical group. A text area in the group keeps them, and the page prevents them once its code has loaded. |
| `Home` or `End`             | Moves focus to the first or the last button.                                                                                                              |
| `Enter` or `Space`          | Toggles the focused button.                                                                                                                               |

## Controlled and uncontrolled

`selectedKeys` holds the state, as the list of the `id` of each button that is on. A plain `selectedKeys=([...])` starts the group's own state, and `selectedKeys=$bind(signal)` writes your signal. `onSelectionChange` gets the new list each time the user changes it.

## Styling

Style the group with `[data-orientation]` and `[data-disabled]`, and each button with `[data-selected]`. See [Styling](./styling.md).
