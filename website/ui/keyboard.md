# Keyboard

A keyboard shortcut, as a `<kbd>`.

```brm demo KeyboardDemo

```

- `as` renders another element.
- It reads left to right in every language, so a shortcut keeps its order in a page that is right to left.

## Use cases

### A list of shortcuts in a page that reads right to left

The page is `dir="rtl"`, and each shortcut still reads `Ctrl`, then the letter, left to right.

```brm demo KeyboardListDemo

```

## Props

```props Keyboard

```

## Data attributes

A `Keyboard` sets no data attributes. It sets `dir="ltr"`.

## Styling

Style the `<kbd>` by its class or the `kbd` selector. See [Styling](./styling.md).
