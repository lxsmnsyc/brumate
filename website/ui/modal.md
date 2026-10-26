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
