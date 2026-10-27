# Toolbar

A toolbar where the arrow keys move focus between its items.

```brm demo ToolbarDemo

```

- Left and Right move focus in a horizontal toolbar, and Up and Down in a vertical one. Home and End go to the first and the last item.
- Right to left, as in an [I18nProvider](./i18n-provider.md) of `ar` or `he`, Left and Right turn around.
- Tab stops at one item, the one that had focus last, and the next Tab leaves the toolbar. This is the roving tabindex of the WAI-ARIA toolbar.
- A text field inside keeps the keys that move its caret.
- The arrow keys skip items that are disabled or have `aria-disabled="true"`, such as a pending button.
- It is `role="toolbar"` with `aria-orientation`, and a `group` when it is inside another toolbar. Name it with `aria-label` or `aria-labelledby`.
- A [ToggleButtonGroup](./toggle-button-group.md) inside leaves the keys to the toolbar.

## Anatomy

```html
<Toolbar>
  <Button />
  <Separator />
  <ToggleButtonGroup>
    <ToggleButton />
  </>
</>
```

The items are any parts that take focus, such as buttons, links and fields. The `Separator` and the `ToggleButtonGroup` are optional.

## Props

```props Toolbar

```

## Data attributes

| Attribute          | When                                     |
| ------------------ | ---------------------------------------- |
| `data-orientation` | Always, with `horizontal` or `vertical`. |

## Keyboard

| Key                         | Action                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the item that had it last, or to the first item. The next `Tab` leaves the toolbar.   |
| `ArrowRight` or `ArrowLeft` | In a horizontal toolbar, moves focus to the next or the previous item. Right to left, the keys swap. |
| `ArrowDown` or `ArrowUp`    | In a vertical toolbar, moves focus to the next or the previous item. A text area keeps them.         |
| `Home`                      | Moves focus to the first item.                                                                       |
| `End`                       | Moves focus to the last item.                                                                        |

Focus stops at the first and the last item. A text field keeps the keys that move its caret.

## Styling

Style the toolbar with `[data-orientation='vertical']`. See [Styling](./styling.md).
