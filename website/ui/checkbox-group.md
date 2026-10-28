# CheckboxGroup

Checkboxes with one value, the list of the checked ones.

```brm demo CheckboxGroupDemo

```

- Each [Checkbox](./checkbox.md) in the group names itself with `value`.
- With `isRequired`, the browser asks for a box when the form is sent, and a `FieldError` shows the message. The browser knows no required group of checkboxes, so this works once the code of the group runs. Without scripts, the form posts with no box checked, and the server checks it.
- It is a `group`, named by its `Label` and described by its `Text slot="description"`.

## Anatomy

```brm anatomy CheckboxGroupAnatomy
`CheckboxGroup`: Holds the boxes and the list of the checked values. It is a `group`.
`Label`: Names the group.
`Checkbox`: One choice, named by its `value`.
`Text`: Describes the group, with `slot="description"`.
`FieldError`: Shows while the group is invalid. The picture forces it with `isInvalid`.
```

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

The props of a box are on the [Checkbox](./checkbox.md#props) page. Those of the Label, Text and FieldError are on the [TextField](./text-field.md#props) page.

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

`value` holds the list of the `value` of each checked box. How you pass it picks who keeps it:

```brm demo CheckboxGroupStateDemo

```

- `value` alone, or nothing, makes the group keep its own list. `value=(['b'])` is where that list starts, and a new value from you replaces it.
- `value=$bind(signal)` writes your signal. Change the signal and the boxes follow.
- `value=$bind(signal, (next) => ...)` asks you first. The group shows what you keep, so a request that you ignore leaves the old list. Press Lock above and click a box of the last group. The line under the groups shows that Asks keeps its list. The hidden input of a box that you refused is not put back yet, so a form would still post it until the next reset.
- `onChange` gets the list in every shape, each time the user changes it.
- A reset of the form gives back the list that the group started with, as a write: with `$bind(signal, request)`, your request can refuse it.
- The server renders the list it starts with. See [State](./state.md).

## Styling

Style the group with the data attributes above, and each box from its own, such as `[data-selected]`. See [Styling](./styling.md).

This stylesheet turns the boxes into chips that fill when checked. It styles rest, hover, press, checked, checked and hovered, checked and pressed, keyboard focus, invalid and disabled, and the description and the error. Clear all the chips and press Order. The group is required, and the error shows once its code has loaded.

```brm styled CheckboxGroupStyled

```

## Use cases

### A filter bar

A group bound to a signal gives the page the list of the kinds. With none checked, the list shows everything.

```brm demo CheckboxGroupFilterDemo

```

### A limit of choices

The request of `$bind` can refuse a list. This one keeps at most two colors, and says so in the description. The group shows what you keep, so the box that the user clicked is drawn off again. The hidden input of that box is not put back yet. Check the list on the server too.

```brm demo CheckboxGroupLimitDemo

```
