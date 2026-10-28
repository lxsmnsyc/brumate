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

## Controlled and uncontrolled

A Link has no state of its own. The caller sets `isCurrent` and `isDisabled`, so the Link is not controlled or uncontrolled. See [State](./state.md) for the parts that keep a value. A Link is one element, so this page has no anatomy picture.

## Styling

Style the link with the data attributes above, such as `[data-current]` for the link of the open page. See [Styling](./styling.md).

This stylesheet styles rest, hover, press, keyboard focus, current and disabled. Its tokens are at the top, and they follow the color scheme.

```brm styled LinkStyled

```

## Use cases

### A navigation

A `nav` with a Link for each page. `isCurrent` follows a signal that `onPress` writes, and a disabled Link leaves the order of Tab. In an app with a router, set `isCurrent` from the route.

```brm demo LinkNavDemo

```

### A link in a sentence, and one that acts

A Link with `href` is an `<a>`, so `target` and `rel` pass to it. A Link without `href` has `role="link"` and a place in the order of Tab, and `onPress` runs what it does. Use it for an action that reads as a link, such as opening a longer text. For anything else, use a [Button](./button.md).

```brm demo LinkActionDemo

```
