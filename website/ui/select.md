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

`selectedKey` holds the key of the selected item, or `null`. `selectedKey=(key)` starts the field's own selection, and `selectedKey=$bind(signal)` writes your signal. `onSelectionChange` gets each new key. `isOpen` holds whether the list is open in the same way, and `onOpenChange` gets each change. A reset of the form gives back the key that the Select started with. See [State](./state.md).

## Styling

Style the field with the data attributes above, such as `[data-open]` and `[data-invalid]`, and the value with `[data-placeholder]`. The Button and the items show their own attributes. See [Styling](./styling.md).

## Opening and choosing

- A press of the Button opens the list. So do ArrowDown and ArrowUp on the Button. Focus goes to the selected item, or else to the first item for ArrowDown and the last for ArrowUp.
- In the list, the arrow keys, Home, End and typing move focus, as in a ListBox.
- A press, Enter or Space on an item selects it and closes the list. Focus goes back to the Button.
- Escape, Tab and a press outside close the list with no change.
- While the list is closed, ArrowLeft and ArrowRight on the Button select the item before or after the selected one. With nothing selected, both select the first item. Typing selects the item that starts with the text. The list stays closed.
- The Popover keeps the items in the page while it is closed, out of sight, so the Select can read them.

## The value in the Button

`SelectValue` shows the text of the selected item, or `placeholder` of the Select, `Select an item` by default. It shows `data-placeholder` while nothing is selected.

The server does not know the text of a key that the Select starts with, so the HTML shows the key until the code loads. `render`, a `#template`, names the selection in the HTML too. It gets `selectedKey`, `selectedText` and `isPlaceholder`. A template parameter takes a type, such as `state: { selectedKey: Key | null }`.

```html
<Button><SelectValue render=sizeName /></Button>

#template sizeName(state: { selectedKey: Key | null }) {
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
