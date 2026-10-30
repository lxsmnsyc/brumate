# Heading

A heading of `level` 1 to 6, 3 by default.

- A part that holds it can set its level or its ID through its context, such as a [Dialog](./dialog.md), whose `slot="title"` heading names it.
- `slot` picks the heading that a part means.

## Use cases

### The title of a dialog

`slot="title"` makes the Heading the name of the [Dialog](./dialog.md), and `level` places it in the outline of the page. Here the page has an `h2`, so the title is a level 3. Without `level`, it is a 3 anyway.

```brm demo HeadingDialogDemo

```

## Props

```props Heading

```

## Data attributes

A `Heading` sets no data attributes. A part that holds it can give it attributes through its context.
