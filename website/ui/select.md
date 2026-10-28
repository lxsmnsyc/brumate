# Select

A field that picks one item from a list, which opens from a button.

```brm demo SelectDemo

```

```html
<Select name="animal" selectedKey=$bind(animal)>
  <Label>Favorite animal</Label>
  <Button><SelectValue /></Button>
  <Popover>
    <ListBox>
      <ListBoxItem id="cat">Cat</ListBoxItem>
      <ListBoxItem id="dog">Dog</ListBoxItem>
    </ListBox>
  </Popover>
</Select>
```

- A `Select` holds a `Label`, a `Button` with a `SelectValue`, a `Popover` with a [ListBox](./list-box.md), and can hold a `Text` with `slot="description"` and a `FieldError`.
- `selectedKey` is the key of the selected item, or `null`. `selectedKey=(key)` starts its own selection, and `selectedKey=$bind(signal)` writes the caller's. See [State](./state.md).
- `onSelectionChange` gets each new key.
- `isOpen` alone starts the list open, and `isOpen=$bind(signal)` writes the caller's. `onOpenChange` gets each change.
- `isDisabled` keeps the list closed, and `disabledKeys` on the ListBox, or `isDisabled` on an item, keeps items from selection.
- The Select shows `data-open`, `data-disabled`, `data-invalid` and `data-required`.

## Anatomy

```brm anatomy SelectAnatomy
`Label`: Names the field. It is read with the value as the name of the Button.
`Button`: Opens the list. It shows the focus ring and `aria-expanded`.
`SelectValue`: Shows the text of the selected item, or the placeholder.
`Text` with `slot="description"`: Describes the field. Optional.
`Popover`: Holds the list. It opens next to the Button and closes on Escape or a press outside.
`ListBoxItem`: One choice. The selected item shows `data-selected`.
```

```html
<Select>
  <Label />
  <Button>
    <SelectValue />
  </>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <ListBox>
      <ListBoxItem />
    </>
  </>
</>
```

The `Text` and the `FieldError` are optional.

## Props

### Select

```props Select

```

### SelectValue

```props SelectValue

```

The [Label, Text and FieldError](./text-field.md#props) are those of a TextField, the [Button](./button.md#props) is a Button, the [Popover](./popover.md) is a Popover, and the [ListBox](./list-box.md#props) holds the items.

## Data attributes

### Select

| Attribute       | When                   |
| --------------- | ---------------------- |
| `data-open`     | The list is open.      |
| `data-disabled` | The field is disabled. |
| `data-invalid`  | The field has errors.  |
| `data-required` | The field is required. |

### SelectValue

| Attribute          | When                 |
| ------------------ | -------------------- |
| `data-placeholder` | Nothing is selected. |

The items show [the attributes of a ListBoxItem](./list-box.md#data-attributes).

## Keyboard

| Key                         | Action                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Tab`                       | Moves focus to the Button. In the open list, it closes the list.                                                 |
| `Enter` or `Space`          | On the Button, opens the list. On an item, selects it and closes the list.                                       |
| `ArrowDown`                 | On the Button, opens the list at the selected item, else at the first. In the list, moves to the next item.      |
| `ArrowUp`                   | On the Button, opens the list at the selected item, else at the last. In the list, moves to the previous item.   |
| `ArrowLeft` or `ArrowRight` | On the Button of a closed list, selects the item before or after the selected one.                               |
| `Home` or `End`             | In the list, moves focus to the first or the last item.                                                          |
| `Escape`                    | Closes the list with no change.                                                                                  |
| `a` to `z`                  | On the Button of a closed list, selects the item that starts with the text. In the open list, moves focus to it. |

## Controlled and uncontrolled

`selectedKey` holds the key of the selected item, or `null`. `isOpen` holds whether the list is open in the same way. How you pass each one picks who keeps it:

```brm demo SelectStateDemo

```

- `selectedKey` alone, or nothing, makes the Select keep its own selection. `selectedKey="cat"` is where that selection starts. Pick another item and the Select keeps the pick. A new value from you replaces it.
- `selectedKey=$bind(signal)` writes your signal. Change the signal and the Select follows.
- `selectedKey=$bind(signal, (next) => ...)` asks you first. The Select shows what you keep, so a request that you ignore leaves the old key. Press Lock above and pick an item in the last field.
- `onSelectionChange` gets each new key in every shape, and `onOpenChange` each change of `isOpen`.
- A reset of the form gives back the key that the Select started with. The server renders the key it starts with.

See [State](./state.md) for the other parts.

## Styling

Style the field with the data attributes above, such as `[data-open]` and `[data-invalid]`, and the value with `[data-placeholder]`. The Button and the items show their own attributes. The Popover sets `--trigger-width`, the width of the Button, and `--available-height`, the room left in the window. See [Styling](./styling.md) for the attributes of every part.

This stylesheet styles every state: rest, hover, press, keyboard focus, open, invalid, disabled, and the items of the list. Open the list, tab to the Button, or press Order with nothing chosen. Its tokens are at the top, and they follow the color scheme.

```brm styled SelectStyled

```

## Use cases

### A Select in a form

Put `name` on the Select and it sends the key with its form, also before the code of the page loads. `isRequired` makes the browser check it, and the FieldError shows the message. A Reset button gives back the key that the Select started with.

```brm demo SelectFormDemo

```

### Sections with descriptions

A `ListBoxSection` with a `Header` groups the items. An item with a `Text` of `slot="label"` and one of `slot="description"` needs `hasLabel` and `hasDescription`, and `textValue` sets what the Button shows and what typing matches.

```brm demo SelectSectionsDemo

```

## Opening and choosing

- A press of the Button opens the list. So do ArrowDown and ArrowUp on the Button. Focus goes to the selected item, or else to the first item for ArrowDown and the last for ArrowUp.
- In the list, the arrow keys, Home, End and typing move focus, as in a ListBox.
- A press, Enter or Space on an item selects it and closes the list. Focus goes back to the Button.
- Escape, Tab and a press outside close the list with no change.
- While the list is closed, ArrowLeft and ArrowRight on the Button select the item before or after the selected one. With nothing selected, both select the first item. Typing selects the item that starts with the text. The list stays closed.
- The Popover keeps the items in the page while it is closed, out of sight, so the Select can read them.

## The value in the Button

`SelectValue` shows the text of the selected item, or `placeholder` of the Select, `Select an item` by default. It shows `data-placeholder` while nothing is selected.

The server does not know the text of a key that the Select starts with, so the HTML shows the key until the code loads. `render`, a `#template`, names the selection in the HTML too. It gets `selectedKey`, `selectedText` and `isPlaceholder`.

```html
<Button><SelectValue render=sizeName /></Button>

#template sizeName(state) {
  {sizes.find((size) => size.id === state.selectedKey)?.name ?? 'None'}
}
```

A reset of the form gives back the key that the Select started with.

## Forms

- `name` sends the key of the selected item with its form, in an input out of sight. It goes with the form also before the code of the page loads.
- `isRequired` asks the browser to check the field when its form is sent. The FieldError shows the message of the browser, and focus moves to the Button.
- A server error for the `name` in a [Form](./form.md) shows in the FieldError until the selection changes.
- `isInvalid` marks the field invalid.

## Names

The Button is named by the value and the Label, so a screen reader reads "Cat, Favorite animal". The ListBox is named by the Label. The Button gets `aria-haspopup="listbox"`, `aria-expanded` and `aria-controls`, and `aria-describedby` names the description and the error.
