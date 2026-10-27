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
- Focus that leaves both hides it at once, and so does a press of the trigger. A press on plain content outside moves no focus, so it hides nothing.
- Escape hides it, and gives focus back to the trigger. That focus does not show it again.

## Anatomy

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

`isOpen` holds whether the preview shows. `isOpen=(true)` starts it shown, and `isOpen=$bind(signal)` writes your signal. `onOpenChange` gets each new state. See [State](./state.md).

## Styling

Style the preview as a [Popover](./popover.md#styling). See [Styling](./styling.md).
