# PreviewTrigger

A preview of a link or a button, such as a card of the author behind a name. It shows on hover, on focus from the keyboard, and on a long press of a touch.

```brm demo PreviewTriggerDemo

```

- A `PreviewTrigger` holds a [Link](./link.md) or a [Button](./button.md), and a [Popover](./popover.md). Unlike a [Tooltip](./tooltip.md), the preview can hold links and buttons.
- Hover and focus from the keyboard show it after `delay`, 600 milliseconds by default. Once a preview has shown, the others show at once, until none has shown for half a second.
- A touch that holds the trigger for half a second shows it. The press of the trigger is cancelled, so the release presses nothing and a link does not navigate. The browser shows no menu for the held link.
- Escape closes it wherever focus is. Focus inside it, or on the trigger, keeps it open while the pointer moves elsewhere.
- It is not modal, and focus stays where it is when it shows. The trigger gets `aria-expanded` and `aria-controls`.
- `isOpen` is the state. See [State](./state.md). `isDisabled` never shows it.

## Closing

- Leaving the trigger and the preview hides it after `closeDelay`, 200 milliseconds by default. The pointer can move from the trigger onto the preview.
- Focus that leaves both hides it at once, and so does a press of the trigger from the keyboard. A press of the mouse hides it, and the pointer that stays on the trigger shows it again. A press on plain content outside moves no focus, so it hides nothing.
- Escape hides it, and gives focus back to the trigger. That focus does not show it again.

## Anatomy

```brm anatomy PreviewTriggerAnatomy
`Link`: The trigger. It gets `aria-expanded` and `aria-controls`. A `Button` works too.
`Popover`: The preview. It is not modal, and it can hold links and buttons.
`OverlayArrow`: Points from the preview to the trigger. Optional.
```

The picture draws the Popover in place, open, under the trigger, so that it can carry a number. The real Popover shows in a layer at the end of the page, next to the trigger, and the rest of the page stays active.

```html
<PreviewTrigger>
  <Link />
  <Popover>
    <OverlayArrow />
  </>
</>
```

The trigger is a `Link` or a `Button`. The `OverlayArrow` is optional.

## Props

```props PreviewTrigger

```

## Data attributes

A `PreviewTrigger` sets no data attributes. The [Popover](./popover.md#data-attributes) shows its own, and the trigger shows those of a [Link](./link.md#data-attributes) or a [Button](./button.md#data-attributes).

## Keyboard

| Key                | Action                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the trigger. Focus from the keyboard shows the preview after `delay`.          |
| `Tab`              | On the trigger of a preview that shows, moves focus into the preview.                         |
| `Tab`              | At the end of the preview, moves focus to the element after the trigger.                      |
| `Shift + Tab`      | At the start of the preview, moves focus back to the trigger.                                 |
| `Enter` or `Space` | Presses the trigger, and hides the preview. A link follows its `href`.                        |
| `Escape`           | Hides the preview wherever focus is. From inside the preview, focus goes back to the trigger. |

The preview renders at the end of the page, in a [layer](./layers.md), so Tab moves between it and the page as if it came right after the trigger.

## Controlled and uncontrolled

`isOpen` holds whether the preview shows. Hover and focus from the keyboard change it in every shape below:

```brm demo PreviewTriggerStateDemo

```

- `isOpen` alone, or nothing, makes the `PreviewTrigger` keep its own state: hover, focus, Escape and a press change it. `isOpen=(true)`, or a bound signal that starts `true`, shows the preview once the page has loaded. It closes as one opened by hover does, when the pointer and focus leave the trigger and the preview. The server renders no preview, since it needs the rect of its trigger.
- `isOpen=$bind(signal)` writes your signal. "Show or hide the second" sets it, and the preview follows.
- `isOpen=$bind(signal, (next) => ...)` asks you first. The preview shows what you keep, so a request that you ignore leaves it hidden. Lock the last one, then hover its link.
- `onOpenChange` gets each new state in every shape.
- A PreviewTrigger is not a form field, so a reset of a form around it changes nothing. The server renders the trigger and no preview.

See [State](./state.md) for the other parts.

## Styling

Style the preview as a [Popover](./popover.md#styling). See [Styling](./styling.md).

This stylesheet styles the link in every state (rest, hover, press, keyboard focus, and `aria-expanded` while the preview shows), the card with its closed look, the arrow on both sides, and the Follow button. Hover the name, or Tab to it. Its tokens are at the top, and they follow the color scheme.

```brm styled PreviewTriggerStyled

```

## Use cases

### Names in a text

Each name in the text has its own `PreviewTrigger`. Hover one and the card shows after `delay`. Move to the next name and its card shows at once, since one preview has just shown. The pointer can go from the name onto the card to press Follow.

```brm demo PreviewTriggerMentionsDemo

```

### A Button that previews and presses

The trigger can be a `Button`. The preview shows a file's first lines on hover or focus. A press runs `onPress` and opens the file. After a hover the card fades out and then shows again within about 370 ms, since the pointer is still on the trigger. A press with the keyboard hides it.

```brm demo PreviewTriggerFilesDemo

```
