# Modal

A dialog over the page, which the user deals with before they go on, such as a confirmation.

```brm demo ModalDemo

```

- A `ModalOverlay` covers the window, and holds a `Modal`, the box of the dialog, which often holds a [Dialog](./dialog.md). A `Modal` on its own renders its overlay too, and takes the props of the overlay.
- It opens from a [DialogTrigger](./dialog.md#dialogtrigger), or from its own `isOpen`. See [State](./state.md).
- It renders in a [layer](./layers.md) at the end of the page.
- The overlay is `position: fixed` over the whole window. It has `data-modal-overlay`, and sets `--visual-viewport-height`, the height of the window without a keyboard on the screen. The Modal has `data-modal`.
- While it is open, the rest of the page is `inert` and does not scroll. The root gets `overflow: hidden`, and a padding as wide as the scrollbar, so the page does not move sideways.
- Focus moves into it, stays inside, and goes back when it closes, as in a [Popover](./popover.md#focus).
- Escape closes it, unless `isKeyboardDismissDisabled`. A press on the overlay, outside the Modal, closes it only with `isDismissable`. The press is a pointerdown and a pointerup of the first button.
- A Modal inside a Modal opens an overlay of its own, over the first, and Escape closes only the top one.
- A [Sheet](./sheet.md) is a Modal along an edge of the window.

## Anatomy

```brm anatomy ModalAnatomy
`Button`: Opens the modal. It gets `aria-expanded`, and `aria-controls` while the modal is open.
`ModalOverlay`: Covers the window and dims the page. Optional.
`Modal`: The box over the overlay.
`Dialog`: The dialog. Here an `alertdialog`, since the modal needs an answer.
`Heading` with `slot="title"`: Names the dialog.
`Button` with `slot="close"`: Closes the modal.
```

The picture draws the trigger, the ModalOverlay, the Modal and the Dialog in place, open, each as a block of its own, so that each layer can carry a number. The real overlay opens in a layer at the end of the page, over the whole window, and the rest of the page is inert while it is open.

```html
<DialogTrigger>
  <Button />
  <ModalOverlay>
    <Modal>
      <Dialog>
        <Heading slot="title" />
        <Button slot="close" />
      </>
    </>
  </>
</>
```

The `ModalOverlay` is optional: a `Modal` renders one around itself. The `DialogTrigger` is optional when the overlay has its own `isOpen`.

## Props

### ModalOverlay

```props ModalOverlay

```

### Modal

```props Modal

```

## Data attributes

### ModalOverlay

| Attribute            | When                                                    |
| -------------------- | ------------------------------------------------------- |
| `data-modal-overlay` | Always.                                                 |
| `data-closed`        | It has `transition`, and it is closed or about to open. |
| `data-enter`         | It has `transition`, and its enter is running.          |
| `data-leave`         | It has `transition`, and its leave is running.          |
| `data-transition`    | It has `transition`, and it is entering or leaving.     |

### Modal

| Attribute    | When    |
| ------------ | ------- |
| `data-modal` | Always. |

## Keyboard

| Key                | Action                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the trigger button.                                                                                                                   |
| `Enter` or `Space` | Presses the trigger button, which opens the modal.                                                                                                   |
| `Tab`              | In the modal, moves focus to the next element, and wraps at the end.                                                                                 |
| `Shift + Tab`      | In the modal, moves focus to the previous element, and wraps at the start.                                                                           |
| `Escape`           | Closes the modal when focus is inside it, unless `isKeyboardDismissDisabled` is set or a part inside used the key. A tooltip that shows hides first. |

## Controlled and uncontrolled

Inside a `DialogTrigger`, the trigger holds whether the modal is open. A modal with its own `isOpen` ignores the trigger:

```brm demo ModalStateDemo

```

- Inside a `DialogTrigger` with no `isOpen`, the trigger keeps the state. A press of the Button toggles it. Escape closes it, and so does a press on the overlay with `isDismissable`.
- A modal with `isOpen=$bind(signal)` writes your signal. Your own button sets it, with no trigger. `onOpenChange` runs when the modal closes itself, and not when you write the signal.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The modal makes a request when Escape would close it, and shows what you keep. Press "Asks you first", press Lock in the dialog, then Escape: the request is refused and the modal stays. Your own write, as the Close button does, is not a request, so it always works. Keep such a lock short, since a modal that refuses to close traps the user.
- `isOpen=(true)` alone is meant to start a modal open, but it does not show on load: an [effect never runs when the page loads](../docs/effects.md), and the overlay opens from one on its open value, which a start value of `true` never changes. Open it from an event.
- A Modal is not a form field, so a reset of a form around it changes nothing. The server renders no modal: it opens once the code loads.

See [State](./state.md) for the other parts.

## Styling

Style the overlay and the box with the data attributes above, such as `[data-closed]` on the overlay. The overlay sets `--visual-viewport-height`. See [Styling](./styling.md).

This stylesheet styles the trigger, the Cancel button and the danger button in every state, the dim overlay, and the box, which scales in as the overlay fades in. Press Delete the draft, Tab through the two buttons, then press the dim area. Its tokens are at the top, and they follow the color scheme.

```brm styled ModalStyled

```

## Use cases

### Unsaved changes

A form in a modal can lose work, so this one guards itself. `isKeyboardDismissDisabled` follows the form: while the text differs from the saved one, Escape does nothing. Cancel then opens a second Modal over the first, and Escape closes only that one. The press on a clean form closes at once.

```brm demo ModalUnsavedDemo

```

### Opened from code

A modal needs no trigger. When the work ends, the code sets the signal that `isOpen` is bound to. This one opens when a slow action is done. The pending Button keeps its focus, and the modal gives focus back to it when it closes.

```brm demo ModalPublishDemo

```

## Animating it

`transition` on the overlay lets CSS animate the overlay and the Modal, with `data-closed`, `data-enter` and `data-leave` on the overlay. It waits for the animations of both:

```css
.backdrop[data-closed] {
  opacity: 0;
}

.backdrop[data-closed] > .modal {
  scale: 0.96;
}
```
