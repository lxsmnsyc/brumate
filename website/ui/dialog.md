# Dialog

The content of an overlay that people act on, such as a [Popover](./popover.md) or a [Modal](./modal.md).

```brm demo DialogDemo

```

- It is a `dialog`, or an `alertdialog` with `role="alertdialog"`. A `Heading` with `slot="title"` names it.
- A `Button` with `slot="close"` closes the overlay around it.
- When the overlay opens, focus moves to the element of the dialog with `autofocus`, or to the dialog itself, so a screen reader reads its title.

## Anatomy

```brm anatomy DialogAnatomy
`Button`: Opens the overlay. It gets `aria-expanded`, and `aria-controls` while the overlay is open.
`Popover`: The overlay around the dialog. A `Modal` can take its place.
`Dialog`: The `dialog`. It takes focus when the overlay opens, and a `Heading` names it.
`Heading` with `slot="title"`: Names the dialog. Optional with `aria-label`.
`Button` with `slot="close"`: Closes the overlay. Optional.
```

The picture draws the Popover in place, open, as a block of its own under the trigger, so that each layer can carry a number. The real Popover opens in a layer at the end of the page, and the rest of the page is inert while it is open.

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

A `Dialog` has no state. The `DialogTrigger` around it holds whether the overlay is open:

```brm demo DialogStateDemo

```

- `isOpen` alone, or nothing, makes the `DialogTrigger` keep its own state. A press of the Button toggles it, and so do Escape and a press outside, which close the overlay through the trigger. `isOpen=(true)` is meant as the state where it starts, but a start value of `true` does not show an overlay when the page loads: checked in Chrome on this site, nothing appeared. Start it closed and open it from an event. The demo above does not use it.
- `isOpen=$bind(signal)` writes your signal. Press "Open or close from outside" and the signal opens the popover that the second button owns.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The overlay shows what you keep, so a request that you ignore leaves it closed. Lock the last one and press its Button.
- `onOpenChange` gets each new state in every shape. An overlay can also take its own `isOpen`, with no `DialogTrigger`: see [Popover](./popover.md#controlled-and-uncontrolled) and [Modal](./modal.md#controlled-and-uncontrolled).
- A Dialog is not a form field, so a reset of a form around it changes nothing. The server renders the Button, and no overlay: an overlay opens once the code loads.

See [State](./state.md) for the other parts.

## Styling

A `Dialog` and a `DialogTrigger` set no data attributes. Style the dialog by its class, and the overlay around it by the data attributes of the [Popover](./popover.md#data-attributes) or the [Modal](./modal.md#data-attributes). See [Styling](./styling.md).

This stylesheet styles the Button in every state (rest, hover, press, keyboard focus, open), the closed look of the Popover, the dialog, its title and its close Button. The dialog takes focus when it opens, so it draws no ring of its own. Its tokens are at the top, and they follow the color scheme.

```brm styled DialogStyled

```

## Use cases

### A confirmation

A `Modal` with a `Dialog` of `role="alertdialog"` asks before something that cannot be undone. A `Button` with `slot="close"` closes the overlay and still runs its own `onPress`, so "Delete" removes the file and closes. `autofocus` on "Keep it" puts focus on the safe answer when the dialog opens. The overlay has its own `isOpen`, so one Modal serves every row. Escape and "Keep it" close it with focus back on the Delete button that opened it. After "Delete" the row and its button are gone, so focus goes to the page, and a real list should move it to the next row.

```brm demo DialogConfirmDemo

```

### A form in a popover

The Popover holds a [Form](./form.md) inside its Dialog. The browser checks the required name when Save is pressed, and `onSubmit` runs only for a valid name, so it saves and closes the popover by writing the signal of the `DialogTrigger`. `onOpenChange` copies the saved name into the draft each time the popover opens, so Cancel throws a draft away. `autofocus` on the Input moves focus to the field.

```brm demo DialogRenameDemo

```

## DialogTrigger

Opens an overlay from a `Button` inside it.

- It holds a `Button` and an overlay, such as a `Popover` or a `Modal`. The button gets `aria-expanded`, and `aria-controls` while the overlay is open, and a press toggles the overlay. It gets no `aria-haspopup`, because screen readers read a popup button as a menu.
- `isOpen` is the state. See [State](./state.md).
- It renders only its children.
- An overlay inside another one needs a `DialogTrigger` of its own, or its own `isOpen`.
