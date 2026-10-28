# RadioGroup

Native radios with one name, from which the user picks one.

```brm demo RadioGroupDemo

```

- Each `Radio` is a `<label>` around a native radio, and names itself with `value`. Draw the circle in the children. See [Styling](./styling.md#boxes).
- `orientation` sets `aria-orientation`. `isRequired` asks for a choice when the form is sent.
- It is a `radiogroup`, named by its `Label`.

## Anatomy

```brm anatomy RadioGroupAnatomy
`RadioGroup`: Holds the radios and the chosen value. It is a `radiogroup`.
`Label`: Names the group.
`Radio`: One choice, named by its `value`. It shows `data-selected` when chosen.
`Text`: Describes the group, with `slot="description"`.
`FieldError`: Shows while the group is invalid. The picture forces it with `isInvalid`.
```

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

`value` holds the `value` of the chosen radio, or `null` for no choice. How you pass it picks who keeps it:

```brm demo RadioGroupStateDemo

```

- `value` alone, or nothing, makes the group keep its own choice, with none chosen at first. `value="b"` is where that choice starts, and a new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the radios follow.
- `value=$bind(signal, (next) => ...)` asks you first. The group shows what you keep, so a request that you ignore leaves the old choice. Press Lock above and choose a radio of the last group. The line under the groups shows that Asks keeps its choice. The hidden input of a radio that you refused is not put back yet, so a form would still post it until the next reset.
- `onChange` gets the `value` of the chosen radio in every shape.
- A reset of the form gives back the choice that the group started with, as a write: with `$bind(signal, request)`, your request can refuse it. A group that started with no choice goes back to none.
- The server renders the choice it starts with. See [State](./state.md).

## Styling

Style the group with the data attributes above, and draw each circle from the attributes of its radio. See [Styling](./styling.md#boxes).

This stylesheet makes each radio a card with a ring, a name and a note. It styles rest, hover, press, chosen, chosen and hovered, chosen and pressed, keyboard focus, invalid and disabled. Press Choose with nothing picked, once the code of the group has loaded, to see the error. The focus ring has two bands, so it shows on the tinted card.

```brm styled RadioGroupStyled

```

## Use cases

### A plan and its seats

Two groups bound to signals feed one total. A radio group holds one choice, so each question gets its own group.

```brm demo RadioGroupPlanDemo

```

### A required choice in a form

With `isRequired`, the browser asks for a choice when the form is sent, and the `FieldError` shows the message. Reset gives back no choice.

```brm demo RadioGroupShippingDemo

```
