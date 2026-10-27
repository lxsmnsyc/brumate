# Group

Parts that belong together, such as an input and its buttons.

```brm demo GroupDemo

```

- It is `role="group"` by default. Name it with `aria-label` or `aria-labelledby`.
- It shows `data-focus-within` while focus is inside it, and `data-hovered`, `data-disabled` and `data-invalid`.

## Anatomy

```html
<Group>
  <Input />
  <Button />
</>
```

The children are any parts. These two are an example.

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
