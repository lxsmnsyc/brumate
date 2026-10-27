# Link

A link that presses as a button does, and that the browser follows.

```brm demo LinkDemo

```

- With `href`, it is an `<a>`. Without, it is an element with `role="link"`.
- `isCurrent` sets `aria-current="page"` and `data-current`, for the link of the page that is open.
- A disabled link is a `<span>` with no `href` and `aria-disabled`, so the browser does not follow it. It leaves the order of Tab.
- It shows the attributes of a [Button](./button.md#attributes), and `data-current`.
- A part around it, such as a [PreviewTrigger](./preview-trigger.md), gives it props and handlers through its context. Their handlers run first, then yours.
