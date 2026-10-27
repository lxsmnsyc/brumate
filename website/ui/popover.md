# Popover

An overlay beside its trigger, such as a menu of settings.

```brm demo PopoverDemo

```

- A [DialogTrigger](./dialog.md#dialogtrigger) holds a `Button`, which opens the popover, and a `Popover`, which often holds a [Dialog](./dialog.md).
- It renders in a [layer](./layers.md) at the end of the page, or at the end of the layer of the overlay around it.
- Escape and a press outside close it. A press is a pointerdown and a pointerup of the first button, so a touch that scrolls the page closes nothing. Only the topmost of nested overlays closes.
- `transition` lets CSS animate it, with `data-closed`, `data-enter` and `data-leave`, as a [Transition](./transition.md) does.

## Placement

- `placement` puts it on a side of its trigger, such as `bottom`, `bottom start`, `end` or `top end`. `start` and `end` follow the direction of the locale. It flips to the other side when it does not fit, unless `shouldFlip=(false)`.
- `offset`, `crossOffset` and `containerPadding` set the space to the trigger, along it, and to the edges of the window.
- It is `position: fixed`, placed with `top` and `left`. It follows its trigger as the page scrolls and resizes.
- It shows `data-placement`, the side that it took, and sets `--trigger-width` and `--available-height`.

## Focus

- It is modal: the rest of the page is `inert` and does not scroll, and focus stays inside. Tab and Shift+Tab wrap at its ends, and focus that lands outside or on nothing, such as when the focused element is removed, goes back to the last element that had it.
- `isNonModal` leaves the page and focus as they are. A press outside does not close it, and focus that leaves it does.
- Focus moves into it once it has entered. When it closes, focus goes back:
  - to the element that had focus before it opened;
  - or, when that element is gone, to the trigger with the same ID, such as a trigger that rendered again;
  - or, when nothing had focus, such as when a shortcut opened it, Tab moves on from where the selection was.
- Focus goes back only when it is still in the popover, or on nothing. A close that comes after the user moved focus elsewhere leaves it there.
- When the popover leaves the page while it is open, such as with an `#if` around it, it gives back what it held: the page is no longer `inert`, and focus goes back.

## OverlayArrow

An arrow from the popover to its trigger. The popover places it along its side, with `left` or `top`, and gives it `data-placement`, so CSS points it at the trigger:

```css
.arrow[data-placement='bottom'] {
  top: -6px;
  rotate: 45deg;
}
```
