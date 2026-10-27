# RadioGroup

Native radios with one name, from which the user picks one.

```brm demo RadioGroupDemo

```

- Each `Radio` is a `<label>` around a native radio, and names itself with `value`. Draw the circle in the children. See [Styling](./styling.md#boxes).
- `orientation` sets `aria-orientation`. `isRequired` asks for a choice when the form is sent.
- It is a `radiogroup`, named by its `Label`.

## Anatomy

```html
<RadioGroup>
  <Label />
  <Radio value="a" />
  <Text slot="description" />
  <FieldError />
</>
```

A group holds one or more Radios. The `Label`, the `Text` and the `FieldError` are optional.

## Props

### RadioGroup

```props RadioGroup

```

### Radio

```props Radio

```

## Data attributes

### RadioGroup

| Attribute                       | When                        |
| ------------------------------- | --------------------------- |
| `data-orientation="horizontal"` | The radios lie in a row.    |
| `data-orientation="vertical"`   | The radios lie in a column. |
| `data-disabled`                 | The group is disabled.      |
| `data-readonly`                 | The group is read only.     |
| `data-invalid`                  | The group has errors.       |
| `data-required`                 | The group is required.      |

### Radio

| Attribute            | When                                |
| -------------------- | ----------------------------------- |
| `data-selected`      | It is the chosen radio.             |
| `data-pressed`       | A pointer or a key holds it down.   |
| `data-hovered`       | A mouse or a pen is over it.        |
| `data-focused`       | Its input has focus.                |
| `data-focus-visible` | Its focus shows as a ring.          |
| `data-disabled`      | The radio or the group is disabled. |
| `data-readonly`      | The group is read only.             |
| `data-invalid`       | The group has errors.               |
| `data-required`      | The group is required.              |

## Keyboard

The radios are native, so Tab and the arrow keys work as in every browser, with or without scripts.

| Key                         | Action                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the chosen radio, or to the first when none is chosen. |
| `ArrowDown` or `ArrowRight` | Moves focus and the choice to the next radio.                         |
| `ArrowUp` or `ArrowLeft`    | Moves focus and the choice to the previous radio.                     |
| `Space`                     | Chooses the focused radio, when it is not chosen.                     |

## Controlled and uncontrolled

`value` holds the `value` of the chosen radio, or `null` for no choice. `value=(choice)` starts the group's own value, and `value=$bind(signal)` writes your signal. `onChange` gets the `value` of the radio that the user chose. See [State](./state.md).

## Styling

Style the group with the data attributes above, and draw each circle from the attributes of its radio. See [Styling](./styling.md#boxes).
