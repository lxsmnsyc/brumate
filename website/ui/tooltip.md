# Tooltip

A short description of a button, which shows on hover and on focus from the keyboard.

```brm demo TooltipDemo

```

- A `TooltipTrigger` holds a `Button` and a `Tooltip`. The Tooltip is a `tooltip`, and the Button points to it with `aria-describedby` while it shows.
- Hover shows it after `delay`, 1500 milliseconds by default. Once one tooltip has shown, the others show at once, until none has shown for half a second.
- Focus from the keyboard shows it at once. A touch never shows it, so put nothing in a tooltip that people need.
- It hides `closeDelay` after the pointer leaves, 500 milliseconds by default, and stays while the pointer is over it. Blur, a press of the button and Escape hide it at once.
- `trigger="focus"` shows it only on focus, and `isDisabled` never shows it. `isOpen` on the `TooltipTrigger` is the state. See [State](./state.md).
- It is placed as a [Popover](./popover.md#placement) is, on the `top` by default, with an `OverlayArrow` inside. `transition` animates it.
- It takes no focus and holds no buttons or links. Use a Popover for content that people act on.
- Inside a [DialogTrigger](./dialog.md#dialogtrigger), the Button keeps what the DialogTrigger gives it, so the same button can open a popover and have a tooltip.

## Anatomy

```brm anatomy TooltipAnatomy
`Button`: The trigger. It points to the tooltip with `aria-describedby` while the tooltip shows.
`Tooltip`: The text, a `tooltip` that takes no focus. It sets `data-placement`.
`OverlayArrow`: Points from the tooltip to the trigger. Optional.
```

The picture draws the Tooltip in place, above the Button, shown, so that it can carry a number. The real Tooltip shows in a layer at the end of the page, and takes no space where the button is.

```html
<TooltipTrigger>
  <Button />
  <Tooltip>
    <OverlayArrow />
  </>
</>
```

The `OverlayArrow` is optional.

## Props

### TooltipTrigger

```props TooltipTrigger

```

### Tooltip

```props Tooltip

```

The `OverlayArrow` is described on the [Popover](./popover.md#props) page.

## Data attributes

### Tooltip

| Attribute         | When                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `data-placement`  | It is placed, with the side of the trigger that it took, such as `top`. |
| `data-closed`     | It has `transition`, and it is closed or about to open.                 |
| `data-enter`      | It has `transition`, and its enter is running.                          |
| `data-leave`      | It has `transition`, and its leave is running.                          |
| `data-transition` | It has `transition`, and it is entering or leaving.                     |

## Keyboard

| Key                | Action                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the button. Focus from the keyboard shows the tooltip at once.          |
| `Enter` or `Space` | Presses the button, and hides the tooltip.                                             |
| `Escape`           | Hides the tooltip while it shows. A dialog or a popover around the trigger stays open. |

## Controlled and uncontrolled

`isOpen` on the `TooltipTrigger` holds whether the tooltip shows. Hover and focus from the keyboard change it in every shape below:

```brm demo TooltipStateDemo

```

- `isOpen` alone, or nothing, makes the `TooltipTrigger` keep its own state: hover, focus, blur, a press and Escape change it. `isOpen=(true)` is meant as the state where it starts, but it does not show on load: an [effect never runs when the page loads](../docs/effects.md), and the tooltip opens from one on its open value, which a start value of `true` never changes. Open it from an event.
- `isOpen=$bind(signal)` writes your signal. Hover the second button and the signal says shown. "Show or hide the second" sets the signal, and the tooltip follows at once, with no `delay`.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The tooltip shows what you keep, so a request that you ignore leaves it hidden. Lock the last one, then hover or tab to its Button.
- `onOpenChange` gets each new state in every shape.
- A Tooltip is not a form field, so a reset of a form around it changes nothing. The server renders the Button and no tooltip.

See [State](./state.md) for the other parts.

## Styling

Style the tooltip with the data attributes above, such as `[data-placement='top']` and `[data-closed]`. See [Styling](./styling.md).

This stylesheet styles the trigger in every state (rest, hover, press, keyboard focus), the tooltip and its closed look, and the arrow on each of the four sides. Hover each button, or Tab to it. The third one opens beside the button. Its tokens are at the top, and they follow the color scheme.

```brm styled TooltipStyled

```

## Use cases

### Icon buttons in a toolbar

A button with a glyph needs a name, so `aria-label` names it, and the tooltip adds the shortcut as its description. The [Toolbar](./toolbar.md) moves focus with the arrow keys, and focus from the keyboard shows the tooltip at once. Once one tooltip has shown, the next shows without waiting for `delay`.

```brm demo TooltipToolbarDemo

```

### One button, a tooltip and a popover

A `TooltipTrigger` inside a `DialogTrigger` keeps what the `DialogTrigger` gives the Button. Hover or focus from the keyboard shows the tooltip, and a press hides it and opens the popover. Escape on a focused trigger hides the tooltip.

```brm demo TooltipPopoverDemo

```
