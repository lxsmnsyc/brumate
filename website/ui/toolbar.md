# Toolbar

A toolbar where the arrow keys move focus between its items.

```brm demo ToolbarDemo

```

- Left and Right move focus in a horizontal toolbar, and Up and Down in a vertical one. Home and End go to the first and the last item.
- Right to left, as in an [I18nProvider](./i18n-provider.md) of `ar` or `he`, Left and Right turn around.
- Tab stops at one item, the one that had focus last, and the next Tab leaves the toolbar. This is the roving tabindex of the WAI-ARIA toolbar.
- A text field inside keeps the keys that move its caret.
- A [ToggleButtonGroup](./toggle-button-group.md) inside leaves the keys to the toolbar.
