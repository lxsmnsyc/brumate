# Separator

A line between two parts of the content.

```brm demo SeparatorDemo

```

- It is an `<hr>`.
- With `orientation="vertical"`, it is an element with `role="separator"` and `aria-orientation`.

## Props

```props Separator

```

## Data attributes

| Attribute          | When                                     |
| ------------------ | ---------------------------------------- |
| `data-orientation` | Always, with `horizontal` or `vertical`. |

## Styling

Style the line with `[data-orientation='vertical']`. See [Styling](./styling.md). A Separator is one element and takes no keys, so this page has no anatomy picture.

This stylesheet draws a rule of 1px in both orientations. The line is 50% of the text color, which keeps about 3:1 against the page in light and dark.

```brm styled SeparatorStyled

```

## Use cases

### Groups in a toolbar

A vertical `Separator` between the buttons of a [Toolbar](./toolbar.md) tells the groups apart. It takes no focus.

```brm demo SeparatorMenuDemo

```
