# Boxes

Parts that people check and choose: `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Radio` and `Switch`.

Each is a `<label>` around a native input, which stays for screen readers and forms. The browser toggles it on a click and on Space, and moves between radios with the arrow keys, with or without scripts. Draw the box in the children. See [Styling](./styling.md#boxes).

## Checkbox

```brm demo CheckboxDemo

```

- `isSelected` is its state. See [State](./state.md).
- `isIndeterminate` shows that some of a list is selected. Only code can set it on the input, so only an indeterminate box loads any, when the browser is idle.
- `isReadOnly` keeps its state: the click is prevented, so the browser never toggles it.
- `name` and `value` post with the form.
- The label shows `data-selected`, `data-indeterminate`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid` and `data-required`.

## CheckboxGroup

Checkboxes with one value, the list of the checked ones.

```brm demo CheckboxGroupDemo

```

- Each `Checkbox` in the group names itself with `value`.
- With `isRequired`, the browser asks for a box when the form is sent, and a `FieldError` shows the message.
- It is a `group`, named by its `Label` and described by its `Text slot="description"`.

## RadioGroup and Radio

Native radios with one name.

```brm demo RadioDemo

```

- `value` is the chosen radio, or `null`.
- The arrow keys move the choice, and Tab stops at the chosen radio, as in every browser.
- `orientation` sets `aria-orientation`. `isRequired` asks for a choice when the form is sent.

## Switch

A native checkbox with `role="switch"`, for a setting that applies at once.

```brm demo SwitchDemo

```
