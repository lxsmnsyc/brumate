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
