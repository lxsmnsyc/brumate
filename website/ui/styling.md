# Styling

The parts render no CSS. Style them with classes and the `data-*` attributes of their state. This page styles one part of each kind in full, with the CSS beside the result.

```html
<Button class="button">Save</Button>

<style>
  :global(.button) {
    padding: 0.5rem 1rem;
    border-radius: 8px;
  }

  :global(.button[data-pressed]) {
    background: #ddd;
  }

  :global(.button[data-focus-visible]) {
    outline: 2px solid royalblue;
  }
</style>
```

- A `class` that you pass adds to the classes of the part.
- The styles of a component are scoped to the elements that it writes. A part renders its own elements, so select them with `:global`, under a class of yours.
- An attribute is there only while the state is on, such as `[data-selected]`. It is never `data-selected="false"`.

## The attributes

| Attribute            | When                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `data-hovered`       | A mouse or a pen is over the part. A touch never hovers.                |
| `data-pressed`       | A pointer or a key holds the part down.                                 |
| `data-focused`       | The part, or its input, has focus.                                      |
| `data-focus-visible` | The focus shows as a ring, as `:focus-visible` says, such as after Tab. |
| `data-selected`      | A toggle, a box or a radio is on.                                       |
| `data-disabled`      | The part is disabled.                                                   |
| `data-invalid`       | A field has errors.                                                     |

Each part lists its own attributes on its page.

## A button

A button has rest, hover, press, keyboard focus, disabled and pending. Each is an attribute, so each is one rule. Press, tab and hover below.

```brm styled StylingButtonDemo

```

## A field

The field holds the state of the group, and the `Input` holds its own. Style the border on the input and the label on the field. `data-invalid` comes from `isInvalid`, a failed `isRequired` or a server error, and `FieldError` shows only while it holds. Send the form empty to see it.

```brm styled StylingFieldDemo

```

## A collection

A list has one rule for each state of an item. `data-focus-visible` is the ring of the keyboard, `data-hovered` never fires on touch, and `data-selected` is the choice. Select two items, then use the arrow keys.

```brm styled StylingListDemo

```

## An overlay

An overlay renders in a layer at the end of `<body>`, so a rule that depends on a parent of the trigger does not reach it. Give the overlay its own class. `transition` on the Popover keeps it in the page while it leaves, and `data-closed` marks the closed look, so CSS animates both ways. The [Transition](./transition.md) page covers the steps.

```brm styled StylingOverlayDemo

```

## Transitions

- Put the resting look on the class and the closed look on `[data-closed]`, with a `transition` on the class. The same rule plays on the way in and the way out.
- `data-enter` and `data-leave` mark the frames of the move, for a keyframe animation.
- Wrap the rule in `@media (prefers-reduced-motion: reduce)` and set `transition: none`, as each example above does.

## Dark mode

The parts have no colors, so dark mode is the CSS you write. Two ways work, and the examples above use both:

- Use system colors such as `Canvas`, `CanvasText` and `color-mix()`, which follow `color-scheme`.
- Keep the colors in custom properties on the root class of the part, and override them in `@media (prefers-color-scheme: dark)`. For a switch in the page, override them under `[data-theme='dark']` too. Check the contrast of text on the accent in both themes.

A rule for an overlay puts the custom properties on the overlay class as well, since the layer is not inside your root.

## Boxes

A `Checkbox`, a `Radio` and a `Switch` hide their native input, which keeps working for screen readers and forms. Draw the box in the children, from the attributes of the label:

```html
<Checkbox class="box">
  <span class="mark" aria-hidden="true"></span>
  Subscribe
</Checkbox>

<style>
  :global(.box[data-selected] .mark) {
    background: royalblue;
  }
</style>
```

## Bars

A `Meter` and a `ProgressBar` set `--percentage`, from `0%` to `100%`, so CSS can draw the bar:

```css
.bar::after {
  content: '';
  height: 0.5rem;
  background: linear-gradient(to right, royalblue var(--percentage), #ddd 0);
}
```
