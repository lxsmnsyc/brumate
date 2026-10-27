# VisuallyHidden

Hides its content from sight, and keeps it for screen readers, such as the name of a button that shows only a mark.

```brm demo VisuallyHiddenDemo

```

- `as` renders another element, such as `as="a"` for a link that skips to the content.
- With `focusable`, the content shows while it has focus.

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
