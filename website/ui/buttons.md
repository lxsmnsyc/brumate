# Buttons and links

Parts that people press: `Button`, `ToggleButton`, `ToggleButtonGroup`, `Link` and `FileTrigger`.

## Button

A button that presses with a mouse, a touch, a pen, Enter, Space, or a screen reader. Each way calls the same handlers.

```brm demo PressDemo

```

- `onPress` runs when a press ends on the button. `onPressStart`, `onPressEnd`, `onPressUp` and `onPressChange` follow each step, and their event has `pointerType`: `mouse`, `touch`, `pen`, `keyboard` or `virtual`.
- `isDisabled` sets `disabled` on the button. `isPending` keeps its focus and presses nothing, such as while a form sends.
- `type` is `button` by default, so a button in a form does not send it. Use `type="submit"` for one that does.
- `as` renders another element, such as `as="a"`, with `role="button"` and a place in the order of Tab.

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | It has focus.                     |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | It is disabled.                   |
| `data-pending`       | It is pending.                    |

A press that leaves the button ends without `onPress`, and starts again when the pointer comes back. Space never scrolls the page.

## ToggleButton and ToggleButtonGroup

A `ToggleButton` stays pressed, with `aria-pressed` and `data-selected`. A `ToggleButtonGroup` holds several, and keeps their selection.

```brm demo ToggleDemo

```

- `isSelected` is the state of a `ToggleButton`. See [State](./state.md).
- In a group, each button names itself with `id`, and `selectedKeys` is the list of the ones that are on.
- `selectionMode="single"`, the default, makes the group a `radiogroup` of radios. `"multiple"` makes it a toolbar of toggle buttons.
- `disallowEmptySelection` keeps one button on.
- The arrow keys move focus between the buttons of a group, as in a [Toolbar](./structure.md#toolbar).

## Link

A link that presses as a button does, and that the browser follows.

```brm demo LinkDemo

```

- With `href`, it is an `<a>`. Without, it is an element with `role="link"`.
- `isCurrent` sets `aria-current="page"` and `data-current`, for the link of the page that is open.
- A disabled link has no `href`, so the browser does not follow it. It keeps its place in the order of Tab, with `aria-disabled`, so a keyboard user hears that it is there.

## FileTrigger

Opens the file picker of the browser from a `Button` inside it.

```brm demo FileTriggerDemo

```

- `onSelect` gets the files that the user picked.
- `acceptedFileTypes`, `allowsMultiple`, `defaultCamera` and `acceptDirectory` set the input.
- The input is hidden, so the picker needs scripts. For a form that must work without them, use a visible `<input type="file">`.
