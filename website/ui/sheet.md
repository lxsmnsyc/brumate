# Sheet

A [Modal](./modal.md) along an edge of the window, such as a menu or a panel of filters.

```brm demo SheetDemo

```

- It is a `Modal` with `data-sheet` and `data-side`, and takes its props. CSS places it, since only the page knows how wide it is.
- `side` is `start`, the default, `end`, `top` or `bottom`. `start` and `end` follow the direction of the locale, so `data-side` is `left`, `right`, `top` or `bottom`.
- A press outside closes it, unless `isDismissable=(false)`.

## Anatomy

```html
<DialogTrigger>
  <Button />
  <Sheet>
    <Dialog>
      <Heading slot="title" />
      <Button slot="close" />
    </>
  </>
</>
```

The `Heading` and the close `Button` are optional. The `DialogTrigger` is optional when the `Sheet` has its own `isOpen`.

## Props

```props Sheet

```

A `Sheet` also takes the props of a [Modal](./modal.md#props), such as `transition` and `onOpenChange`.

## Data attributes

| Attribute    | When                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| `data-sheet` | Always.                                                                  |
| `data-side`  | Always, with the edge of the window: `left`, `right`, `top` or `bottom`. |
| `data-modal` | Always, as on a [Modal](./modal.md#data-attributes).                     |

The overlay around it has the data attributes of a [ModalOverlay](./modal.md#data-attributes).

## Keyboard

The keys are those of a [Modal](./modal.md#keyboard). `Escape` closes a sheet, and `Tab` stays inside it.

## Controlled and uncontrolled

`isOpen` holds whether the sheet is open, as on a [Modal](./modal.md#controlled-and-uncontrolled). `isOpen=(true)` starts it open, and `isOpen=$bind(signal)` writes your signal. Inside a `DialogTrigger`, the trigger holds it. See [State](./state.md).

## Styling

Place the sheet with `[data-side='left']`, `[data-side='right']`, `[data-side='top']` and `[data-side='bottom']`. Animate it with `transition`, which a `Sheet` takes through its props like a `Modal`. See [Styling](./styling.md).
