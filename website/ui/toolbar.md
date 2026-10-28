# Toolbar

A toolbar where the arrow keys move focus between its items.

```brm demo ToolbarDemo

```

- Left and Right move focus in a horizontal toolbar, and Up and Down in a vertical one. Home and End go to the first and the last item.
- Right to left, as in an [I18nProvider](./i18n-provider.md) of `ar` or `he`, Left and Right turn around.
- Once focus has entered the toolbar, Tab stops at one item, the one that had focus last, and the next Tab leaves the toolbar. This is the roving tabindex of the WAI-ARIA toolbar. Before the first focus, every item is in the order of Tab, so the first Tab goes to the first item and the next Tab to the second.
- A text field inside keeps the keys that move its caret.
- The arrow keys skip items that are disabled or have `aria-disabled="true"`, such as a pending button.
- It is `role="toolbar"` with `aria-orientation`, and a `group` when it is inside another toolbar. Name it with `aria-label` or `aria-labelledby`.
- A [ToggleButtonGroup](./toggle-button-group.md) inside leaves the keys to the toolbar.

## Anatomy

```brm anatomy ToolbarAnatomy
`Toolbar`: Moves focus between its items with the arrow keys.
`Button`: An item. Any part that takes focus can be one.
`Separator`: A line between groups of items.
`ToggleButtonGroup`: A group of items inside the toolbar. It leaves its keys to the toolbar.
`ToggleButton`: An item of that group.
```

```html
<Toolbar>
  <Button />
  <Separator />
  <ToggleButtonGroup>
    <ToggleButton />
  </>
</>
```

The items are any parts that take focus, such as buttons, links and fields. The `Separator` and the `ToggleButtonGroup` are optional. The `Separator` is only a line, so it is not an item that focus stops on.

## Props

```props Toolbar

```

## Data attributes

| Attribute          | When                                     |
| ------------------ | ---------------------------------------- |
| `data-orientation` | Always, with `horizontal` or `vertical`. |

## Keyboard

| Key                         | Action                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the item that had it last. Before the first focus, every item takes Tab in turn. After it, the next `Tab` leaves the toolbar.                                                               |
| `ArrowRight` or `ArrowLeft` | In a horizontal toolbar, moves focus to the next or the previous item. Right to left, the keys swap.                                                             |
| `ArrowDown` or `ArrowUp`    | In a vertical toolbar, moves focus to the next or the previous item. A text area keeps them. Like Home and End, the page prevents them once its code has loaded. |
| `Home`                      | Moves focus to the first item.                                                                                                                                   |
| `End`                       | Moves focus to the last item.                                                                                                                                    |

Focus stops at the first and the last item. A text field keeps the keys that move its caret.

## Styling

Style the toolbar with `[data-orientation='vertical']`. See [Styling](./styling.md).

This stylesheet makes a horizontal and a vertical bar. Its items have hover, press, on, disabled and a two-band focus ring. Press Tab to enter a bar, then the arrow keys to move in it.

```brm styled ToolbarStyled

```

## State

A toolbar keeps no value. After focus has entered it, the item that Tab stops at is the one that had focus last, and the toolbar keeps that as the `tabindex` of its items, in the page, not in a signal. Before that, no item has a `tabindex`, so all of them are in the order of Tab. A form reset leaves it as it is. The items hold their own state: see [ToggleButtonGroup](./toggle-button-group.md#controlled-and-uncontrolled).

## Use cases

### A formatting bar

Toggle buttons write a list, buttons change a size within limits, and a text field takes the keys that move its caret. Once focus is in the field, the arrow keys, Home and End stay in it, and Tab leaves it. The size buttons clamp the size and stay enabled: a button that disables itself while it has focus drops focus to the page, since the browser does that for any disabled button.

```brm demo ToolbarEditorDemo

```

### Right to left

Inside an [I18nProvider](./i18n-provider.md) with an Arabic locale, ArrowLeft moves to the next item. Put `dir="rtl"` on an element yourself, since the provider renders none.

```brm demo ToolbarArabicDemo

```
