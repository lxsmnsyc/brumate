# Dialog

The content of an overlay that people act on, such as a [Popover](./popover.md) or a [Modal](./modal.md).

```brm demo DialogDemo

```

- It is a `dialog`, or an `alertdialog` with `role="alertdialog"`. A `Heading` with `slot="title"` names it.
- A `Button` with `slot="close"` closes the overlay around it.
- When the overlay opens, focus moves to the element of the dialog with `autofocus`, or to the dialog itself, so a screen reader reads its title.

## DialogTrigger

Opens an overlay from a `Button` inside it.

- It holds a `Button` and an overlay, such as a `Popover` or a `Modal`. The button gets `aria-expanded` and `aria-controls`, and a press toggles the overlay. It gets no `aria-haspopup`, as in React Aria, because screen readers read a popup button as a menu.
- `isOpen` is the state. See [State](./state.md).
- It renders only its children.
- An overlay inside another one needs a `DialogTrigger` of its own, or its own `isOpen`.
