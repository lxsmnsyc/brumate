# Popover

An overlay beside its trigger, such as a menu of settings.

```brm demo PopoverDemo

```

- A [DialogTrigger](./dialog.md#dialogtrigger) holds a `Button`, which opens the popover, and a `Popover`, which often holds a [Dialog](./dialog.md).
- In a Select, its content stays in the page while it is closed, out of sight, so the Select knows its items.
- It renders in a [layer](./layers.md) at the end of the page, or at the end of the layer of the overlay around it.
- Escape and a press outside close it. A press is a pointerdown and a pointerup of the first button, so a touch that scrolls the page closes nothing. Only the topmost of nested overlays closes.
- `transition` lets CSS animate it, with `data-closed`, `data-enter` and `data-leave`, as a [Transition](./transition.md) does.

## Anatomy

```brm anatomy PopoverAnatomy
`Button`: Opens the popover. It gets `aria-expanded`, and `aria-controls` while the popover is open.
`Popover`: The layer beside the trigger. It sets `data-placement`, `--trigger-width` and `--available-height`.
`OverlayArrow`: Points from the popover to the trigger. The popover moves it along the side. Optional.
`Dialog`: The content that people act on. It takes focus when the popover opens.
`Heading` with `slot="title"`: Names the dialog. Optional with `aria-label`.
```

The picture draws the Popover in place, open, as a block of its own under the trigger, so that each layer can carry a number. The real Popover opens in a layer at the end of the page, next to the trigger, and the rest of the page is inert while it is open.

```html
<DialogTrigger>
  <Button />
  <Popover>
    <OverlayArrow />
    <Dialog>
      <Heading slot="title" />
    </>
  </>
</>
```

The `OverlayArrow` and the `Heading` are optional. The `DialogTrigger` is optional too when the `Popover` has its own `isOpen`.

## Props

### Popover

```props Popover

```

### OverlayArrow

```props OverlayArrow

```

## Data attributes

### Popover

| Attribute         | When                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `data-placement`  | It is placed, with the side of the trigger that it took, such as `top`. |
| `data-closed`     | It has `transition`, and it is closed or about to open.                 |
| `data-enter`      | It has `transition`, and its enter is running.                          |
| `data-leave`      | It has `transition`, and its leave is running.                          |
| `data-transition` | It has `transition`, and it is entering or leaving.                     |

### OverlayArrow

| Attribute        | When                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `data-placement` | The popover is placed, with the side of the trigger that it took. |

## Keyboard

| Key                | Action                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the trigger button.                                                                                                                                                                                                                                                                    |
| `Enter` or `Space` | Presses the trigger button, which opens or closes the popover.                                                                                                                                                                                                                                        |
| `Tab`              | In the popover, moves focus to the next element. A modal popover wraps at its end.                                                                                                                                                                                                                    |
| `Shift + Tab`      | In the popover, moves focus to the previous element. A modal popover wraps at its start.                                                                                                                                                                                                              |
| `Escape`           | Closes the popover when focus is inside it. A part inside that used the key, such as a search field, keeps it. A tooltip that shows hides first. With `isNonModal`, it also closes the topmost popover when focus is on its trigger or on nothing, and not when focus is in a field or another layer. |

## Controlled and uncontrolled

Inside a `DialogTrigger`, the trigger holds whether the popover is open, with `isOpen` and `onOpenChange`. These popovers are not modal (`isNonModal`), so the buttons below stay usable while one is open:

```brm demo PopoverStateDemo

```

- `isOpen` alone, or nothing, makes the `DialogTrigger` keep its own state. A press of the Button toggles it, and so does Escape or focus that leaves a non-modal popover. `isOpen=(true)`, or a bound signal that starts `true`, starts it open: once the page has loaded the popover is placed at its trigger, with focus in it and the page inert as after a press. The server renders no popover, since it needs the rect of its trigger, so it shows when the code loads.
- `isOpen=$bind(signal)` on the `DialogTrigger` writes your signal. "Open or close from outside" sets it, and the popover follows.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The popover shows what you keep, so a request that you ignore leaves it closed. Lock the last one and press its Button.
- `onOpenChange` of the `DialogTrigger` gets each new state in every shape.
- A `Popover` with its own `isOpen` ignores the trigger: `isOpen=$bind(signal)` writes your signal, and its `onOpenChange` runs when the popover closes itself. It is placed next to a trigger only inside a `DialogTrigger`.
- A Popover is not a form field, so a reset of a form around it changes nothing. The server renders the Button, and no popover: it opens once the code loads. In a Select, the content stays in the page while it is closed.

See [State](./state.md) for the other parts.

## Styling

Style the popover with the data attributes above, such as `[data-placement='top']` and `[data-closed]`. It sets the CSS custom properties `--trigger-width`, the width of the trigger, and `--available-height`, the height that is left in the window. See [Styling](./styling.md).

This stylesheet styles the trigger in every state (rest, hover, press, keyboard focus, open), the closed look of the popover on both sides, the arrow on both sides, and the items in the popover. The popover is at least as wide as its trigger. Press Share, then Tab through the items. Its tokens are at the top, and they follow the color scheme.

```brm styled PopoverStyled

```

## Use cases

### Where it opens

`placement` picks the side. Press each button: `bottom start` and `bottom end` line up with the start and the end of the trigger, `top` opens above it, and `end` opens beside it. When the popover does not fit on the side that you asked for, it flips, and `data-placement` and the arrow follow. Scroll the demo toward the edge of the window and open `top` to see it.

```brm demo PopoverPlacementDemo

```

### A filter in a popover

A popover holds more than a menu. This one holds a [CheckboxGroup](./checkbox-group.md) bound to a signal, so the list behind it changes as you tick, and the trigger shows how many filters apply. Tab stays inside the popover, and Escape or a press outside closes it with the filters kept.

```brm demo PopoverFiltersDemo

```

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
