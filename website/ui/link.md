# Link

A link that presses as a button does, and that the browser follows.

```brm demo LinkDemo

```

- With `href`, it is an `<a>`. Without, it is an element with `role="link"`.
- `isCurrent` sets `aria-current="page"` and `data-current`, for the link of the page that is open.
- A disabled link has no `href`, so the browser does not follow it. It keeps its place in the order of Tab, with `aria-disabled`, so a keyboard user hears that it is there.
- It shows the attributes of a [Button](./button.md#attributes), and `data-current`.
- A part around it, such as a [PreviewTrigger](./preview-trigger.md), gives it props and handlers through its context. Their handlers run first, then yours.
