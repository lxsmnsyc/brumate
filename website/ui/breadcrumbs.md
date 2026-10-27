# Breadcrumbs

A trail of links to the current page.

```brm demo BreadcrumbsDemo

```

- `Breadcrumbs` is an `<ol>` of `Breadcrumb` items, each with a [Link](./link.md). Put it in a `<nav>` with a label.
- `isCurrent` on the last `Breadcrumb` gives its link `aria-current="page"`. Mark it yourself, since a part cannot read the structure of its children.
- `isDisabled` on `Breadcrumbs` disables every link.

## Anatomy

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
