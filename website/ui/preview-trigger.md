# PreviewTrigger

A preview of a link or a button, such as a card of the author behind a name. It shows on hover, on focus from the keyboard, and on a long press of a touch.

```brm demo PreviewTriggerDemo

```

- A `PreviewTrigger` holds a [Link](./link.md) or a [Button](./button.md), and a [Popover](./popover.md). Unlike a [Tooltip](./tooltip.md), the preview can hold links and buttons.
- Hover and focus from the keyboard show it after `delay`, 600 milliseconds by default. Once a preview has shown, the others show at once, until none has shown for half a second.
- A touch that holds the trigger for half a second shows it, as React Aria's `useLongPress` does. The press of the trigger is cancelled, so the release presses nothing and a link does not navigate. The browser shows no menu for the held link.
- Escape closes it wherever focus is. Focus inside it, or on the trigger, keeps it open while the pointer moves elsewhere.
- It is not modal, and focus stays where it is when it shows. The trigger gets `aria-expanded` and `aria-controls`.
- `isOpen` is the state. See [State](./state.md). `isDisabled` never shows it.

## Closing

- Leaving the trigger and the preview hides it after `closeDelay`, 200 milliseconds by default. The pointer can move from the trigger onto the preview.
- Focus that leaves both hides it at once, and so do a press of the trigger and a press outside.
- Escape hides it, and gives focus back to the trigger. That focus does not show it again.

## Keyboard

The preview renders at the end of the page, in a [layer](./layers.md), so Tab moves between it and the page as if it came right after the trigger:

- Tab on the trigger moves into the preview.
- Tab past the end of the preview moves on to the element after the trigger.
- Shift+Tab before its start goes back to the trigger.
