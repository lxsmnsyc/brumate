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

## Opening and choosing

- A press of the Button opens the list. So do ArrowDown and ArrowUp on the Button. Focus goes to the selected item, or else to the first item for ArrowDown and the last for ArrowUp.
- In the list, the arrow keys, Home, End and typing move focus, as in a ListBox.
- A press, Enter or Space on an item selects it and closes the list. Focus goes back to the Button.
- Escape, Tab and a press outside close the list with no change.

## The value in the Button

`SelectValue` shows the text of the selected item, or `placeholder` of the Select, `Select an item` by default. It shows `data-placeholder` while nothing is selected.

The items are on the page only while the list is open, so a Select does not know the text of a key that it starts with, or that the page sets. `render`, a `#template`, names the selection then. It gets `selectedKey`, `selectedText` and `isPlaceholder`.

```html
<Button><SelectValue render=sizeName /></Button>

#template sizeName(state: { selectedKey: Key | null }) {
  {sizes.find((size) => size.id === state.selectedKey)?.name ?? 'None'}
}
```

Without `render`, the Button shows the key until an item is chosen. A reset of the form gives back the key that the Select started with.

## Forms

- `name` sends the key of the selected item with its form, in an input out of sight. It goes with the form also before the code of the page loads.
- `isRequired` asks the browser to check the field when its form is sent. The FieldError shows the message of the browser, and focus moves to the Button.
- A server error for the `name` in a [Form](./form.md) shows in the FieldError until the selection changes.
- `isInvalid` marks the field invalid.

## Names

The Button is named by the value and the Label, as in React Aria, so a screen reader reads "Cat, Favorite animal". The ListBox is named by the Label. The Button gets `aria-haspopup="listbox"`, `aria-expanded` and `aria-controls`, and `aria-describedby` names the description and the error.
