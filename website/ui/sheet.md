# Sheet

A [Modal](./modal.md) along an edge of the window, such as a menu or a panel of filters.

```brm demo SheetDemo

```

- It is a `Modal` with `data-sheet` and `data-side`, and takes its props. CSS places it, since only the page knows how wide it is.
- `side` is `start`, the default, `end`, `top` or `bottom`. `start` and `end` follow the direction of the locale, so `data-side` is `left`, `right`, `top` or `bottom`.
- A press outside closes it, unless `isDismissable=(false)`.
