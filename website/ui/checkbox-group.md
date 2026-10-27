# CheckboxGroup

Checkboxes with one value, the list of the checked ones.

```brm demo CheckboxGroupDemo

```

- Each [Checkbox](./checkbox.md) in the group names itself with `value`.
- With `isRequired`, the browser asks for a box when the form is sent, and a `FieldError` shows the message. The browser knows no required group of checkboxes, so this works once the code of the group runs. Without scripts, the form posts with no box checked, and the server checks it.
- It is a `group`, named by its `Label` and described by its `Text slot="description"`.

## Anatomy

```html
<CheckboxGroup>
  <Label />
  <Checkbox value="a" />
  <Text slot="description" />
  <FieldError />
</>
```

A group holds one or more Checkboxes. The `Label`, the `Text` and the `FieldError` are optional.

## Props

### CheckboxGroup

```props CheckboxGroup

```

See the [Checkbox](./checkbox.md#props) page for the props of a box, and the [TextField](./text-field.md#props) page for the Label, Text and FieldError.

## Data attributes

| Attribute       | When                    |
| --------------- | ----------------------- |
| `data-disabled` | The group is disabled.  |
| `data-readonly` | The group is read only. |
| `data-invalid`  | The group has errors.   |
| `data-required` | The group is required.  |

The boxes show [their own attributes](./checkbox.md#data-attributes).

## Keyboard

The group adds no keys. Each box takes the keys of a [Checkbox](./checkbox.md#keyboard).

| Key     | Action                                    |
| ------- | ----------------------------------------- |
| `Tab`   | Moves focus to the next box of the group. |
| `Space` | Toggles the focused box.                  |

## Controlled and uncontrolled

`value` holds the list of the `value` of each checked box. `value=([...])` starts the group's own value, and `value=$bind(signal)` writes your signal. `onChange` gets the list each time the user changes it. See [State](./state.md).

## Styling

Style the group with the data attributes above, and each box from its own. See [Styling](./styling.md).
