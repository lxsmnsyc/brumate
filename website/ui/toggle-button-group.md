# ToggleButtonGroup

ToggleButtons with one selection, as radios, or several, as a toolbar.

```brm demo ToggleButtonGroupDemo

```

- Each [ToggleButton](./toggle-button.md) in the group names itself with `id`, and `selectedKeys` is the list of the ones that are on. See [State](./state.md).
- `selectionMode="single"`, the default, makes the group a `radiogroup` of radios. `"multiple"` makes it a toolbar of toggle buttons, or a `group` inside a [Toolbar](./toolbar.md).
- `disallowEmptySelection` keeps one button on.
- Name it with `aria-label` or `aria-labelledby`.

## Anatomy

```brm anatomy ToggleButtonGroupAnatomy
`ToggleButtonGroup`: Holds the buttons and the selection. It is a `radiogroup`, or a toolbar with `selectionMode="multiple"`.
`ToggleButton`: One choice. It names itself with `id`, and shows `data-selected` when it is on.
```

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

`selectedKeys` holds the `id` of each button that is on, as a list. How you pass it picks who keeps it:

```brm demo ToggleButtonGroupStateDemo

```

- `selectedKeys` alone, or nothing, makes the group keep its own selection. `selectedKeys=(['b'])` is where that selection starts. Press another button and the group keeps the pick. A new value from you replaces it.
- `selectedKeys=$bind(signal)` writes your signal. Change the signal and the group follows.
- `selectedKeys=$bind(signal, (next) => ...)` asks you first. The group shows what you keep, so a request that you ignore leaves the old list. Press Lock above and press a button in the last group.
- `onSelectionChange` gets the new list in every shape.
- The server renders the selection it starts with. A ToggleButtonGroup has no reset handler, so a form reset leaves it as it is. See [State](./state.md).

## Styling

Style the group with `[data-orientation]` and `[data-disabled]`, and each button with `[data-selected]`. See [Styling](./styling.md).

This stylesheet makes a segmented control: a track, buttons that fill with the accent when on, and a two-band focus ring that shows on the track and on the fill. Press the arrow keys to move focus.

```brm styled ToggleButtonGroupStyled

```

## Use cases

### A view switch

A group with one selection and `disallowEmptySelection` always shows one view. `selectedKeys=$bind(view)` lets the page read the choice.

```brm demo ToggleButtonGroupViewDemo

```

### Filters with several choices

`selectionMode="multiple"` lets several buttons be on. With none on, the list shows everything. `orientation="vertical"` lays the buttons in a column and moves focus with ArrowUp and ArrowDown.

```brm demo ToggleButtonGroupFilterDemo

```
