# Group

Parts that belong together, such as an input and its buttons.

```brm demo GroupDemo

```

- It is `role="group"` by default. Name it with `aria-label` or `aria-labelledby`.
- It shows `data-focus-within` while focus is inside it, and `data-hovered`, `data-disabled` and `data-invalid`.

## Anatomy

```brm anatomy GroupAnatomy
`Group`: The element with `role="group"`. It shows the state of the whole.
`Input`: A part inside. It keeps its own look and keys.
`Button`: Another part inside.
```

```html
<Group>
  <Input />
  <Button />
</>
```

The children are any parts. These two are an example. The input is marked through a wrapper, since an `<input>` cannot carry a badge.

## Props

```props Group

```

## Data attributes

| Attribute            | When                                               |
| -------------------- | -------------------------------------------------- |
| `data-hovered`       | A mouse or a pen is over it.                       |
| `data-focus-within`  | Focus is on the group or on a part inside it.      |
| `data-focus-visible` | Focus is inside it, and its focus shows as a ring. |
| `data-disabled`      | It is disabled, or it has `aria-disabled`.         |
| `data-invalid`       | It is invalid, or it has `aria-invalid`.           |

## Keyboard

A `Group` takes no keys. The parts inside it keep their own.

## Styling

Style the group with the data attributes above, such as `[data-focus-within]` for a ring around an input and its buttons. See [Styling](./styling.md).

This stylesheet draws one frame for an input and a button. The frame reads the group's attributes: hover, focus inside, a ring for the keyboard, invalid and disabled. The input draws no frame of its own. Press Tab to see the ring.

```brm styled GroupStyled

```

## State

A group keeps no state. Hover, focus and the flags come from the pointer, the focus and the props, and the group does not write them anywhere you can bind. A form reset leaves it as it is. The server renders it without hover and focus.

## Use cases

### A quantity with buttons

`isInvalid` on the group shows `data-invalid` and `aria-invalid="true"`, so the frame can warn about the whole, not one piece.

```brm demo GroupAmountDemo

```

### A search field with a button

A group inside a `TextField` frames the input and its button. The button waits until there is text.

```brm demo GroupSearchDemo

```
