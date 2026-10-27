# Button

A button that presses with a mouse, a touch, a pen, Enter, Space, or a screen reader. Each way calls the same handlers.

```brm demo ButtonDemo

```

- `onPress` runs when a press ends on the button. `onPressStart`, `onPressEnd`, `onPressUp` and `onPressChange` follow each step, and their event has `pointerType`: `mouse`, `touch`, `pen`, `keyboard` or `virtual`.
- `onHoverStart`, `onHoverEnd` and `onHoverChange` follow a mouse or a pen. A touch never hovers.
- `isDisabled` sets `disabled` on the button. `isPending` keeps its focus and presses nothing, such as while a form sends.
- `type` is `button` by default, so a button in a form does not send it. Use `type="submit"` for one that does.
- `as` renders another element, such as `as="a"`, with `role="button"` and a place in the order of Tab. `as` takes the name of an element or a component, and the other props are those of the target, so `as="a"` takes `href`, and a prop that the target does not take is a type error. `ButtonProps` is the props type. See [Props types](../docs/typescript.md#props-types).
- A press that leaves the button ends without `onPress`, and starts again when the pointer comes back. Space never scrolls the page.

## Props

```props Button

```

## Data attributes

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | It has focus.                     |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | It is disabled.                   |
| `data-pending`       | It is pending.                    |

## Keyboard

| Key                | Action                                                   |
| ------------------ | -------------------------------------------------------- |
| `Tab`              | Moves focus to the button. A disabled button is skipped. |
| `Enter` or `Space` | Presses the button. Space never scrolls the page.        |

## Controlled and uncontrolled

A button has no state of its own. `isDisabled` and `isPending` are set by the caller, and `onPress` and `onPressChange` report what the user does. To keep a pressed state, use a [ToggleButton](./toggle-button.md).

## Styling

Style the button with the data attributes above, such as `[data-pressed]` and `[data-focus-visible]`. See [Styling](./styling.md).

## In other parts

Many parts give the `Button` inside them its role, its state and its handlers through a context, such as the trigger of a [Disclosure](./disclosure.md), of a [DialogTrigger](./dialog.md#dialogtrigger) or of a [TooltipTrigger](./tooltip.md). `slot` picks the button that a part means, such as `slot="close"` in a [Dialog](./dialog.md). The handlers of the part run first, then yours.
