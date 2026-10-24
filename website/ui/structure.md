# Structure

Parts that hold other parts: `Toolbar`, `Group`, `Breadcrumbs`, `Separator` and `Heading`.

## Toolbar

A toolbar where the arrow keys move focus between its items.

```brm demo ToolbarDemo

```

- Left and Right move focus in a horizontal toolbar, and Up and Down in a vertical one. Home and End go to the first and the last item.
- Right to left, as in an `I18nProvider` of `ar` or `he`, Left and Right turn around.
- Tab stops at one item, the one that had focus last, and the next Tab leaves the toolbar. This is the roving tabindex of the WAI-ARIA toolbar.
- A text field inside keeps the keys that move its caret.
- A `ToggleButtonGroup` inside leaves the keys to the toolbar.

## Group

Parts that belong together, such as an input and its buttons.

```brm demo GroupDemo

```

- It is `role="group"` by default. Name it with `aria-label` or `aria-labelledby`.
- It shows `data-focus-within` while focus is inside it, and `data-hovered`, `data-disabled` and `data-invalid`.

## Breadcrumbs

A trail of links to the current page.

```brm demo BreadcrumbsDemo

```

- `Breadcrumbs` is an `<ol>` of `Breadcrumb` items. Put it in a `<nav>` with a label.
- `isCurrent` on the last `Breadcrumb` gives its link `aria-current="page"`. React Aria finds the last item itself. Here, you mark it.
- `isDisabled` on `Breadcrumbs` disables every link.

## Separator and Heading

- `Separator` is an `<hr>`. With `orientation="vertical"`, it is an element with `role="separator"` and `aria-orientation`.
- `Heading` is a heading of `level` 1 to 6, 3 by default. A part that holds it can set the level through its context.
