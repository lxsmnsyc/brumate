# Breadcrumbs

A trail of links to the current page.

```brm demo BreadcrumbsDemo

```

- `Breadcrumbs` is an `<ol>` of `Breadcrumb` items, each with a [Link](./link.md). Put it in a `<nav>` with a label.
- `isCurrent` on the last `Breadcrumb` gives its link `aria-current="page"`. Mark it yourself, since a part cannot read the structure of its children.
- `isDisabled` on `Breadcrumbs` disables every link.

## Anatomy

```brm anatomy BreadcrumbsAnatomy
`Breadcrumbs`: The `<ol>` of the trail.
`Breadcrumb`: One step, an `<li>`. The last one has `isCurrent`.
`Link`: The link of the step.
```

```html
<Breadcrumbs>
  <Breadcrumb>
    <Link />
  </>
</>
```

Put the `Breadcrumbs` in a `<nav>` with a label. The last `Breadcrumb` has `isCurrent`.

## Props

### Breadcrumbs

```props Breadcrumbs

```

### Breadcrumb

```props Breadcrumb

```

## Data attributes

### Breadcrumbs

| Attribute       | When            |
| --------------- | --------------- |
| `data-disabled` | It is disabled. |

### Breadcrumb

| Attribute       | When                                       |
| --------------- | ------------------------------------------ |
| `data-current`  | It is the step for the page that is open.  |
| `data-disabled` | It is disabled, or it is the current step. |

The link in each step shows the data attributes of a [Link](./link.md#data-attributes).

## Keyboard

| Key     | Action                                                                          |
| ------- | ------------------------------------------------------------------------------- |
| `Tab`   | Moves focus to the next link. The current step and a disabled link are skipped. |
| `Enter` | Follows the link that has focus.                                                |

## Styling

Style the trail with the data attributes above, such as `[data-current]` for the last step. Breadcrumbs draw no separator, so add one with CSS, such as `li + li::before`. See [Styling](./styling.md).

This stylesheet draws a `/` before every step but the first with `li + li::before`, links that underline on hover, a disabled step with a line through it, and a bold current step. The picture above uses an icon after each step, since a badge needs the `::before` of its piece.

```brm styled BreadcrumbsStyled

```

## State

Breadcrumbs keep no state. They draw the trail that you give them, so a use case below keeps the path in a signal of its own. A form reset has nothing to reset, and the server renders the trail as it is.

## Use cases

### A path that the user walks

The path is a list in a signal. A Link without `href` is an element with `role="link"` that runs `onPress`, so a press on a step cuts the path back to it, and a button opens a folder.

```brm demo BreadcrumbsFolderDemo

```

### A trail that waits

`isDisabled` on the `Breadcrumbs` disables every link, such as while a form has changes that a click would throw away. The current step is disabled already.

```brm demo BreadcrumbsDirtyDemo

```
