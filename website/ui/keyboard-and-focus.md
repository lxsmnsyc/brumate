# Keyboard and focus

The rules of the keyboard and of focus that the parts share, each stated once, with the parts that follow it. The page of each part has its own table of keys.

## One stop of Tab for a group

A group of items is one stop of Tab, and the arrow keys move focus inside it. WAI-ARIA describes this for a listbox, a grid, a tree, tabs and a toolbar.

- **Where Tab lands.** On the item that had focus last, or else on the first selected item, or else on the first item.
- **Tab from inside** leaves the group. It does not visit the other items.
- **Home and End** go to the first and the last item. PageUp and PageDown go further in a long list.
- **Disabled items** are skipped.
- **The keys of the other axis** keep their default, such as Left and Right in a vertical list, so a field in an item still works.

Followed by [ListBox](./list-box.md#focus-and-keys), [GridList](./grid-list.md#focus-and-keys), [Table](./table.md), [Tree](./tree.md), [TagGroup](./tag-group.md), [Tabs](./tabs.md#focus-and-keys) and [Toolbar](./toolbar.md). A Tabs list lands on the selected tab. A Toolbar keeps every item in the order of Tab until focus first enters it.

A [RadioGroup](./radio-group.md) uses native radios, so the browser moves focus and the choice with the arrow keys, with or without scripts.

## Focus stays in the field

A field that filters or picks from a list keeps focus in its input. The arrow keys move an active item, and `aria-activedescendant` on the input names it, so a screen reader reads it.

- **Enter** acts on the active item, as a press does.
- **The pointer** makes the item under it active.
- **The list is out of the order of Tab**, since the field moves through it.

Followed by [ComboBox](./combo-box.md) and [Autocomplete](./autocomplete.md#focus-and-keys).

## Arrow keys and the direction of the page

- **Right to left**, Left and Right turn around, so the arrow that points to the next item moves to it.
- **Vertical** parts, with `orientation="vertical"`, use Up and Down.
- **The keys that move focus never scroll the page**, also before the code of the part loads. See [How the parts resume](./resuming.md).

Followed by the collections above, and by [Slider](./slider.md), [ColorSlider](./color-slider.md) and the [Calendar](./calendar.md).

## Typing to find an item

In a list of items, typing moves focus to the item whose text starts with what was typed. A letter typed in the second after the last one adds to the text.

- **`textValue`** on an item sets that text, for an item whose content is more than text.
- **A windowed list** finds items that are out of view, scrolls the item into view, then focuses it.

Followed by [ListBox](./list-box.md#focus-and-keys), [GridList](./grid-list.md#focus-and-keys), [Menu](./menu.md#focus-and-keys), [Select](./select.md), [Table](./table.md) and [Tree](./tree.md).

## Focus in an overlay

An overlay takes focus once, when it has opened, and gives it back once, when it closes. The [Popover](./popover.md#focus) page has the full rules.

- **Into the overlay.** Focus moves to the element with `autofocus`, or else to the [Dialog](./dialog.md), so a screen reader reads its title. A Popover that holds a Menu or a ListBox and no Dialog moves focus into the Menu or the ListBox.
- **Once.** Focus moves when the overlay has entered, after its transition. Content that comes later does not move it. See [Content that loads late](./async-content.md).
- **Trapped in a modal.** Tab and Shift+Tab wrap at the ends of a modal overlay, and the rest of the page is `inert`. Focus that lands on nothing, such as when the focused element is removed, goes back to the last element in the overlay that had it.
- **Not trapped in a non-modal overlay.** With `isNonModal`, focus that leaves the overlay closes it. A [PopoverGroup](./popover-group.md) keeps it open when focus moves to another popover of the group.
- **Back when it closes.** Focus goes to the element that had it before the overlay opened, or to the trigger, or, when nothing had focus, to where the selection was. It goes back only from inside the overlay, so a close after the reader moved focus elsewhere leaves it there.
- **A preview takes no focus.** A [PreviewTrigger](./preview-trigger.md) and a submenu opened by hover leave focus where it is, and Tab moves into them.
- **An overlay that starts open** takes focus when the code loads. A non-modal popover leaves focus in a field that the reader is typing in.

Followed by [Popover](./popover.md#focus), [Modal](./modal.md), [Sheet](./sheet.md), [Menu](./menu.md), [Select](./select.md), [ComboBox](./combo-box.md) and the [DatePicker](./date-picker.md).

## Escape

Escape closes one thing at a time, the innermost first.

- **A part inside that used the key keeps it.** A search field with text clears its text, and the overlay around it stays open.
- **A tooltip that shows hides first**, and the next Escape closes the overlay.
- **Nested overlays close from the top.** See [Layers](./layers.md).
- **`isKeyboardDismissDisabled`** on a Modal keeps it open on Escape.

## The focus ring

The focus ring shows when the browser's `:focus-visible` says so, such as after Tab, and not after a press of the pointer.

- **`data-focus-visible`** is on the part while its ring shows. `data-focused` is on it while it has focus, from any source.
- **A key pressed after a pointer moved focus** shows the ring too.
- **CSS can use `:focus-visible` directly.** The data attribute is for a part whose ring is on another element, such as the `<label>` of a [Checkbox](./checkbox.md), whose input has focus.

`focusRing` from `@brumate/ui/focus.brm.ts` gives the same state to a part of your own. See [Your own parts](./your-own-parts.md).

## Related

- [Layers](./layers.md): how overlays stack, and which one Escape closes.
- [How the parts resume](./resuming.md): why the keys are prevented by name, and why a handler checks where focus is.
- [Styling](./styling.md): the data attributes of focus, hover and press.
