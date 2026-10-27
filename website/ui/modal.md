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

## Anatomy

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

| Key                | Action                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Tab`              | Moves focus to the trigger button.                                                                                 |
| `Enter` or `Space` | Presses the trigger button, which opens the modal.                                                                 |
| `Tab`              | In the modal, moves focus to the next element, and wraps at the end.                                               |
| `Shift + Tab`      | In the modal, moves focus to the previous element, and wraps at the start.                                         |
| `Escape`           | Closes the modal when focus is inside it, unless `isKeyboardDismissDisabled` is set or a part inside used the key. |

## Controlled and uncontrolled

Inside a `DialogTrigger`, the trigger holds whether the modal is open, with `isOpen` and `onOpenChange`. A modal with its own `isOpen` ignores the trigger: `isOpen=(true)` starts it open, and `isOpen=$bind(signal)` writes your signal. Its `onOpenChange` then runs when the modal closes itself. See [State](./state.md).

## Styling

Style the overlay and the box with the data attributes above, such as `[data-closed]` on the overlay. The overlay sets `--visual-viewport-height`. See [Styling](./styling.md).
