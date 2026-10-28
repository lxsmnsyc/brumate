# Sheet

A [Modal](./modal.md) along an edge of the window, such as a menu or a panel of filters.

```brm demo SheetDemo

```

- It is a `Modal` with `data-sheet` and `data-side`, and takes its props. CSS places it, since only the page knows how wide it is.
- `side` is `start`, the default, `end`, `top` or `bottom`. `start` and `end` follow the direction of the locale, so `data-side` is `left`, `right`, `top` or `bottom`.
- A press outside closes it, unless `isDismissable=(false)`.

## Anatomy

```brm anatomy SheetAnatomy
`Button`: Opens the sheet. It gets `aria-expanded`, and `aria-controls` while the sheet is open.
`Sheet`: The panel along an edge of the window. It has `data-sheet` and `data-side`.
`Dialog`: The dialog in the panel. It takes focus when the sheet opens.
`Heading` with `slot="title"`: Names the dialog.
`Button` with `slot="close"`: Closes the sheet.
```

The picture draws the window, dimmed, with the Sheet in it, open and in place, so that the pieces can carry numbers. The real Sheet opens in a layer at the end of the page, along the edge of the whole window, and the rest of the page is inert while it is open. The dim area is the overlay that the Sheet renders around itself.

```html
<DialogTrigger>
  <Button />
  <Sheet>
    <Dialog>
      <Heading slot="title" />
      <Button slot="close" />
    </>
  </>
</>
```

The `Heading` and the close `Button` are optional. The `DialogTrigger` is optional when the `Sheet` has its own `isOpen`.

## Props

```props Sheet

```

A `Sheet` also takes the props of a [Modal](./modal.md#props), such as `transition` and `onOpenChange`.

## Data attributes

| Attribute    | When                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| `data-sheet` | Always.                                                                  |
| `data-side`  | Always, with the edge of the window: `left`, `right`, `top` or `bottom`. |
| `data-modal` | Always, as on a [Modal](./modal.md#data-attributes).                     |

The overlay around it has the data attributes of a [ModalOverlay](./modal.md#data-attributes).

## Keyboard

The keys are those of a [Modal](./modal.md#keyboard). `Escape` closes a sheet, and `Tab` stays inside it.

## Controlled and uncontrolled

`isOpen` holds whether the sheet is open, as on a [Modal](./modal.md#controlled-and-uncontrolled). Inside a `DialogTrigger`, the trigger holds it, and a sheet with its own `isOpen` ignores the trigger:

```brm demo SheetStateDemo

```

- Inside a `DialogTrigger` with no `isOpen`, the trigger keeps the state. Escape and a press outside close it.
- `isOpen=$bind(signal)` on the Sheet writes your signal. Your own button sets it. `onOpenChange` runs when the sheet closes itself.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The sheet makes a request when Escape or a press outside would close it, and shows what you keep. Press "Asks you first", press Lock in the dialog, then Escape: the request is refused and the sheet stays. Your own write, as the Close button does, is not a request, so it always works.
- `isOpen=(true)` alone is meant to start a sheet open, but it does not show on load: an [effect never runs when the page loads](../docs/effects.md), and the overlay opens from one on its open value, which a start value of `true` never changes. Open it from an event.
- A Sheet is not a form field, so a reset of a form around it changes nothing. The server renders no sheet: it opens once the code loads.

See [State](./state.md) for the other parts.

## Styling

Place the sheet with `[data-side='left']`, `[data-side='right']`, `[data-side='top']` and `[data-side='bottom']`. Animate it with `transition`, which a `Sheet` takes through its props like a `Modal`. See [Styling](./styling.md).

A `Sheet` passes its class to the box, not to the overlay behind it, which has `data-modal-overlay`. To dim the page, style that overlay from the sheet inside it, with `[data-modal-overlay]:has(> .sheet)`.

This stylesheet places the sheet on each of the four edges, slides it in from its edge as the overlay fades in, and styles the trigger and the close Button in every state. Press each trigger. Its tokens are at the top, and they follow the color scheme.

```brm styled SheetStyled

```

## Use cases

### A menu of pages

A `Button` with `slot="close"` closes the sheet and still runs its own `onPress`, so each item sets the page and closes the menu. Focus goes back to the Menu Button.

```brm demo SheetNavDemo

```

### A panel of filters with Apply

The sheet edits a draft, so a Cancel throws it away. The `DialogTrigger` copies the applied filters into the draft each time the sheet opens, and Apply copies the draft back. The sheet sits on the `end` edge.

```brm demo SheetFiltersDemo

```
