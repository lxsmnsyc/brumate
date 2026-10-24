# Styling

The parts render no CSS. Style them with classes and the `data-*` attributes of their state.

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
