# Breadcrumbs

A trail of links to the current page.

```brm demo BreadcrumbsDemo

```

- `Breadcrumbs` is an `<ol>` of `Breadcrumb` items, each with a [Link](./link.md). Put it in a `<nav>` with a label.
- `isCurrent` on the last `Breadcrumb` gives its link `aria-current="page"`. Mark it yourself, since a part cannot read the structure of its children.
- `isDisabled` on `Breadcrumbs` disables every link.
