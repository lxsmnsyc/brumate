# Link

A link that presses as a button does, and that the browser follows.

```brm demo LinkDemo

```

- With `href`, it is an `<a>`. Without, it is an element with `role="link"`.
- `isCurrent` sets `aria-current="page"` and `data-current`, for the link of the page that is open.
- A disabled link is a `<span>` with no `href` and `aria-disabled`, so the browser does not follow it. It leaves the order of Tab.
- A part around it, such as a [PreviewTrigger](./preview-trigger.md), gives it props and handlers through its context. Their handlers run first, then yours.

## Props

```props Link

```

## Data attributes

| Attribute            | When                                     |
| -------------------- | ---------------------------------------- |
| `data-current`       | It is the link of the page that is open. |
| `data-pressed`       | A pointer or a key holds it down.        |
| `data-hovered`       | A mouse or a pen is over it.             |
| `data-focused`       | It has focus.                            |
| `data-focus-visible` | Its focus shows as a ring.               |
| `data-disabled`      | It is disabled.                          |

## Keyboard

| Key     | Action                                                |
| ------- | ----------------------------------------------------- |
| `Tab`   | Moves focus to the link. A disabled link is skipped.  |
| `Enter` | Presses the link, and the browser follows its `href`. |

## Styling

Style the link with the data attributes above, such as `[data-current]` for the link of the open page. See [Styling](./styling.md).
