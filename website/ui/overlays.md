# Overlays

Content above the page: `DialogTrigger`, `Popover`, `Dialog` and `OverlayArrow`.

## Popover

An overlay beside its trigger, such as a menu of settings.

```brm demo PopoverDemo

```

- A `DialogTrigger` holds a `Button`, which opens the popover, and a `Popover`. The button gets `aria-expanded`, `aria-haspopup` and `aria-controls`.
- `isOpen` on the `DialogTrigger` is the state. See [State](./state.md).
- `placement` puts it on a side of its trigger, such as `bottom`, `bottom start`, `end` or `top end`. `start` and `end` follow the direction of the locale. It flips to the other side when it does not fit, unless `shouldFlip=(false)`.
- `offset`, `crossOffset` and `containerPadding` set the space to the trigger, along it, and to the edges of the window.
- It follows its trigger as the page scrolls and resizes. It shows `data-placement`, the side that it took, and sets `--trigger-width` and `--available-height`.
- Escape and a press outside close it. Focus moves into it, and goes back to the trigger when it closes.
- It is modal: the rest of the page is `inert`, and focus stays inside. Tab and Shift+Tab wrap at its ends, and focus that lands outside or on nothing, such as when the focused element is removed, goes back to the last element that had it. `isNonModal` leaves the page and focus as they are.
- `transition` lets CSS animate it, with `data-closed`, `data-enter` and `data-leave`, as a [Transition](./disclosure.md#transition) does.

## Layers

A popover renders a layer: an element of its own, which holds its panel. A popover that opens inside it renders at the end of that layer, not at the end of the page.

- The inner popover is above the outer one, since it comes after it, with no `z-index`.
- A press in the inner popover is a press inside the outer one, so the outer one stays open. Escape closes the inner one first.
- The layer has no box of its own, so a panel that scrolls or moves with a transform does not clip or move the popovers inside it.
- A popover outside any other renders at the end of `<body>`.

## Dialog

The content of an overlay that people act on.

- It is a `dialog`, or an `alertdialog` with `role="alertdialog"`. A `Heading` with `slot="title"` names it.
- A `Button` with `slot="close"` closes the overlay around it.
- When the overlay opens, focus moves to the element of the dialog with `autofocus`, or to the dialog itself, so a screen reader reads its title.

## OverlayArrow

An arrow from a popover to its trigger. The popover places it along its side, with `left` or `top`, and gives it `data-placement`, so CSS points it at the trigger:

```css
.arrow[data-placement='bottom'] {
  top: -6px;
  rotate: 45deg;
}
```
