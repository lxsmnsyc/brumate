# VisuallyHidden

Hides its content from sight, and keeps it for screen readers, such as the name of a button that shows only a mark.

```brm demo VisuallyHiddenDemo

```

- `as` renders another element, such as `as="a"` for a link that skips to the content.
- With `focusable`, the content shows while it has focus.

## Use cases

### A link that skips the menu

`as="a"` with `focusable` makes a link that sits out of sight until focus reaches it, so a keyboard user can jump over the menu. Click into the sample and press Tab: the link shows.

```brm demo VisuallyHiddenSkipDemo

```

## Props

```props VisuallyHidden

```

## Data attributes

| Attribute        | When                |
| ---------------- | ------------------- |
| `data-focusable` | It has `focusable`. |

## Keyboard

A `VisuallyHidden` takes no keys of its own.

## Styling

The part brings its own styles for hiding. Its `class` adds to them. With `focusable`, the content shows while focus is inside it, as `:focus-within` says. See [Styling](./styling.md).
