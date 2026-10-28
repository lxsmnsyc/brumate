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

| Key                | Action                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the button. A disabled button is skipped; a pending one keeps focus.                                          |
| `Enter` or `Space` | Presses the button. Space never scrolls the page, except on a `submit` or `reset` button, which keeps Space for the browser. |

## Controlled and uncontrolled

A Button has no state of its own, so it has no controlled and uncontrolled shapes. The caller sets `isDisabled` and `isPending`, and `onPress` and `onPressChange` report what the user does. To keep a pressed state, use a [ToggleButton](./toggle-button.md). A reset of a form does nothing to a Button: it is the `type="reset"` button that resets the form. See [State](./state.md) for the parts that keep a value.

## Styling

Style the button with the data attributes above, such as `[data-pressed]` and `[data-focus-visible]`. See [Styling](./styling.md). A Button is one element, so this page has no anatomy picture.

This stylesheet styles every state: rest, hover, press, keyboard focus, pending and disabled. Press a button, tab to it, or look at the last two. Its tokens are at the top, and they follow the color scheme.

```brm styled ButtonStyled

```

## Use cases

### A pending save in a form

`isPending` keeps the focus on the button and presses nothing. A pending submit button keeps `type="submit"` and cancels the submit of its form, so the form does not send again, by a click on the button or by Enter in a field. The handler of the form needs no guard. Enter clicks the default button of the form, which is the first submit button in tree order. With two submit buttons in one form:

- Only the pending button is blocked.
- A click on the other button sends the form.
- Enter sends the form unless the pending button is the first one.
- A submit with no submitter, such as `form.requestSubmit()`, is cancelled when the pending button is the first one.

A pending reset button becomes `type="button"`, so it resets nothing. Here the submit starts a save, the button shows it, and the Reset button waits with `isDisabled` until the save is done.

```brm demo ButtonSaveDemo

```

### Buttons in a toolbar

A [Toolbar](./toolbar.md) moves focus between its buttons with the arrow keys, so the group takes one stop of Tab. A disabled button leaves the arrow order too, and so does a pending one, which has `aria-disabled`. Undo is disabled until there is something to undo.

```brm demo ButtonToolbarDemo

```

## In other parts

Many parts give the `Button` inside them its role, its state and its handlers through a context, such as the trigger of a [Disclosure](./disclosure.md), of a [DialogTrigger](./dialog.md#dialogtrigger) or of a [TooltipTrigger](./tooltip.md). `slot` picks the button that a part means, such as `slot="close"` in a [Dialog](./dialog.md). The handlers of the part run first, then yours.
