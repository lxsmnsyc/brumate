# Checkbox

A `<label>` around a native checkbox, which stays for screen readers and forms. The browser toggles it on a click and on Space, with or without scripts.

```brm demo CheckboxDemo

```

- Draw the box in the children. See [Styling](./styling.md#boxes).
- `isIndeterminate` shows that some of a list is selected. Only code can set it on the input, so only an indeterminate box loads any, when the browser is idle.
- `isReadOnly` keeps its state: the click is prevented, so the browser never toggles it.
- `name` and `value` post with the form.

## Props

```props Checkbox

```

## Data attributes

The label shows the state:

| Attribute            | When                              |
| -------------------- | --------------------------------- |
| `data-selected`      | The box is checked.               |
| `data-indeterminate` | The box is indeterminate.         |
| `data-pressed`       | A pointer or a key holds it down. |
| `data-hovered`       | A mouse or a pen is over it.      |
| `data-focused`       | Its input has focus.              |
| `data-focus-visible` | Its focus shows as a ring.        |
| `data-disabled`      | The box is disabled.              |
| `data-readonly`      | The box is read only.             |
| `data-invalid`       | The box is invalid.               |
| `data-required`      | The box is required.              |

## Keyboard

| Key     | Action                                             |
| ------- | -------------------------------------------------- |
| `Tab`   | Moves focus to the box. A disabled box is skipped. |
| `Space` | Toggles the box.                                   |

## Controlled and uncontrolled

`isSelected` holds the state. How you pass it picks who keeps it:

```brm demo CheckboxStateDemo

```

- `isSelected` alone, or nothing, makes the Checkbox keep its own state. `isSelected` with no value starts it on, and a new value from you replaces it.
- `isSelected=$bind(signal)` writes your signal. Change the signal and the box follows.
- `isSelected=$bind(signal, (next) => ...)` asks you first. The box shows what you keep, so a request that you ignore leaves the old state. Press Lock above and click the last box. The line under the boxes shows that Asks keeps its value. The hidden input of the box that you refused is not put back yet, so a form would post it until the next reset.
- `onChange` gets the new state in every shape, each time the user toggles the box.
- A reset of the form gives back the state that the box started with, as a write: with `$bind(signal, request)`, your request can refuse it. In a [CheckboxGroup](./checkbox-group.md), the group keeps the state and gives it back, and `value` names the box.
- The server renders the state it starts with. See [State](./state.md).

## Styling

Style the box from the attributes of the label, such as `[data-selected]`, `[data-indeterminate]` and `[data-focus-visible]`. Draw the box in the children. See [Styling](./styling.md#boxes). A Checkbox is one element with the content you give it, so this page has no anatomy picture.

This stylesheet draws a box and a check in plain CSS. It styles rest, hover, press, selected, selected and hovered, selected and pressed, indeterminate, keyboard focus, invalid, read only and disabled. Tab to a box and press Space. The focus ring has two bands outside the box, so it shows next to the fill.

```brm styled CheckboxStyled

```

## Use cases

### Consent in a sign-up form

`name` and `value` post the box with the form. A box that must be on before the form goes is checked in the submit handler, and `isInvalid` marks it. The text under the box says why. A standalone Checkbox does not yet tie a description or an error to its input: only a [CheckboxGroup](./checkbox-group.md) does. The node `checkbox-description` is meant to add it. Press Create account with the second box off.

```brm demo CheckboxConsentDemo

```

### Select all

A box that stands for a list is on when all are on and `isIndeterminate` when some are. Its `onChange` sets every item, and the `onChange` of an item sets that item. The first box follows the list.

```brm demo CheckboxSelectAllDemo

```
