# Dialog

The content of an overlay that people act on, such as a [Popover](./popover.md) or a [Modal](./modal.md).

```brm demo DialogDemo

```

- It is a `dialog`, or an `alertdialog` with `role="alertdialog"`. A `Heading` with `slot="title"` names it.
- A `Button` with `slot="close"` closes the overlay around it.
- When the overlay opens, focus moves to the element of the dialog with `autofocus`, or to the dialog itself, so a screen reader reads its title.

## Anatomy

```html
<DialogTrigger>
  <Button />
  <Popover>
    <Dialog>
      <Heading slot="title" />
      <Button slot="close" />
    </>
  </>
</>
```

The overlay is a `Popover` or a `Modal`. The `Heading` and the close `Button` are optional, and so is the `DialogTrigger` when the overlay has its own `isOpen`.

## Props

### Dialog

```props Dialog

```

### DialogTrigger

```props DialogTrigger

```

## Keyboard

| Key                | Action                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the trigger button.                                                                                                                                          |
| `Enter` or `Space` | Presses the trigger button, which opens or closes the overlay.                                                                                                              |
| `Tab`              | In the overlay, moves focus to the next element. A modal overlay wraps at its end.                                                                                          |
| `Shift + Tab`      | In the overlay, moves focus to the previous element. A modal overlay wraps at its start.                                                                                    |
| `Escape`           | Closes the overlay around the dialog. A `Modal` with `isKeyboardDismissDisabled` stays open, and so does a part inside that used the key. A tooltip that shows hides first. |

## Controlled and uncontrolled

A `Dialog` has no state. The `DialogTrigger` holds whether the overlay is open. `isOpen=(true)` starts it open, and `isOpen=$bind(signal)` writes your signal. `onOpenChange` gets each new state. An overlay can also take its own `isOpen`, with no `DialogTrigger`. See [State](./state.md).

## Styling

A `Dialog` and a `DialogTrigger` set no data attributes. Style the dialog by its class, and the overlay around it by the data attributes of the [Popover](./popover.md#data-attributes) or the [Modal](./modal.md#data-attributes). See [Styling](./styling.md).

## DialogTrigger

Opens an overlay from a `Button` inside it.

- It holds a `Button` and an overlay, such as a `Popover` or a `Modal`. The button gets `aria-expanded`, and `aria-controls` while the overlay is open, and a press toggles the overlay. It gets no `aria-haspopup`, because screen readers read a popup button as a menu.
- `isOpen` is the state. See [State](./state.md).
- It renders only its children.
- An overlay inside another one needs a `DialogTrigger` of its own, or its own `isOpen`.
