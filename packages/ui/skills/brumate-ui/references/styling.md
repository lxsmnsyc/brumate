# Styling

The parts render no CSS. Style them with classes and the `data-*` attributes of their state.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
</script>

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

- A `class` you pass adds to the classes of the part.
- The styles of a component are scoped to the elements that it writes. A part renders its own elements, so select them with `:global(...)` under a class of yours. In a plain stylesheet, write `.name`.
- An attribute is there only while the state is on, such as `[data-selected]`. It is never `data-selected="false"`. Select the presence, not a value.
- The parts add no `style` for looks. A few set custom properties and inline positions, which are listed below.

## The attributes

| Attribute            | When                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `data-hovered`       | A mouse or a pen is over the part. A touch never hovers.                |
| `data-pressed`       | A pointer or a key holds the part down.                                 |
| `data-focused`       | The part, or its input, has focus.                                      |
| `data-focus-visible` | The focus shows as a ring, as `:focus-visible` says, such as after Tab. |
| `data-selected`      | A toggle, a box, a radio, an item or a tab is on.                       |
| `data-disabled`      | The part is disabled.                                                   |
| `data-invalid`       | A field has errors.                                                     |
| `data-readonly`      | A field is read only.                                                   |
| `data-required`      | A field is required.                                                    |
| `data-pending`       | A `Button` has `isPending`.                                             |
| `data-open`          | A `Select`, `ComboBox` or `DatePicker` has its list open.               |
| `data-expanded`      | A `Disclosure`, a tree row or a panel is open.                          |
| `data-placeholder`   | A `SelectValue` shows nothing chosen.                                   |
| `data-orientation`   | A list, tabs, a toolbar or a slider: `horizontal` or `vertical`.        |
| `data-placement`     | A `Popover`, `Tooltip` or `OverlayArrow`: the side it took.             |

Each part lists its own attributes on its page.

- Put the state on the part that has it: the field shows `data-invalid`, and so does its `Input`. Style the border on the input and the label on the field.
- `FieldError` renders only while the field is invalid.

## Custom properties

| Property                                | Set by                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `--trigger-width`, `--available-height` | `Popover`: width of the trigger, room left in window |
| `--percentage`                          | `Meter`, `ProgressBar`: `0%` to `100%`               |
| `--visual-viewport-height`              | `ModalOverlay`: height without an on-screen keyboard |

```css
.bar::after {
  content: '';
  height: 0.5rem;
  background: linear-gradient(to right, royalblue var(--percentage), #ddd 0);
}
```

## Boxes

A `Checkbox`, a `Radio` and a `Switch` hide their native input, which keeps working for screen readers and forms. Draw the box in the children, from the attributes of the label.

```brm
<script>
  import Checkbox from '@brumate/ui/Checkbox.brm';
</script>

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

## Overlays and transitions

- An overlay renders in a layer at the end of `<body>`, so a rule that depends on a parent of the trigger does not reach it. Give the overlay its own class, and put custom properties of your theme on that class too.
- `transition` on a `Popover`, `ModalOverlay`, `Tooltip`, `DisclosurePanel` or `ToastRegion` keeps it in the page while it leaves. Put the resting look on the class and the closed look on `[data-closed]`, with a `transition` on the class. The same rule plays in and out.
- `data-enter`, `data-leave` and `data-transition` mark the frames of the move, for a keyframe animation.
- Wrap the rule in `@media (prefers-reduced-motion: reduce)` and set `transition: none`.

```css
.popover {
  transition: opacity 0.2s;
}

.popover[data-closed] {
  opacity: 0;
}
```

## Dark mode

The parts have no colors. Set `color-scheme: light dark`, and use `light-dark(a, b)` or the system colors. Keep colors in custom properties on the root class of the part and on its overlay class.
