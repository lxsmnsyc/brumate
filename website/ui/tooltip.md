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

`isOpen` on the `TooltipTrigger` holds whether the tooltip shows. `isOpen=(true)` starts it shown, and `isOpen=$bind(signal)` writes your signal. `onOpenChange` gets each new state. See [State](./state.md).

## Styling

Style the tooltip with the data attributes above, such as `[data-placement='top']` and `[data-closed]`. See [Styling](./styling.md).
