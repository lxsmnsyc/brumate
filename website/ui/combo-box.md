# ComboBox

A text field with a list of suggestions, which shows the items that match what was typed.

```brm demo ComboBoxDemo

```

```html
<ComboBox name="animal" selectedKey=$bind(animal)>
  <Label>Favorite animal</Label>
  <Input />
  <Button />
  <Popover>
    <ListBox>
      <ListBoxItem id="cat">Cat</ListBoxItem>
      <ListBoxItem id="dog">Dog</ListBoxItem>
    </ListBox>
  </Popover>
</ComboBox>
```

- A `ComboBox` holds a `Label`, an `Input`, a `Button`, a `Popover` with a [ListBox](./list-box.md), and can hold a `Text` with `slot="description"` and a `FieldError`.
- `selectedKey` is the key of the selected item, or `null`. `inputValue` is the text in the input. Each starts its own state, or binds with `$bind`. See [State](./state.md).
- `onSelectionChange`, `onInputChange` and `onOpenChange` get each change.
- The ComboBox shows `data-open`, `data-disabled`, `data-invalid` and `data-required`.

## Typing and choosing

- Typing opens the list, and it shows the items whose text contains what was typed, in any case. The list closes when no item matches.
- `defaultFilter` decides when an item matches, such as `(text, input) => text.startsWith(input)`.
- `menuTrigger="focus"` opens the list when the input gets focus, and `"manual"` opens it only with the keys and the Button.
- ArrowDown and ArrowUp open the list and move through its items, and go round at the ends. Focus stays in the input, and `aria-activedescendant` names the active item. The pointer makes an item active too.
- Enter and a press pick an item. Its text goes in the input, and the list closes. While the list is closed, Enter sends the form.
- The Button opens the list with all of its items. It is out of the order of Tab, as the keys of the input do the same.

## Closing

- Escape closes the list. With the list closed, Escape clears the input and the selection.
- Focus that leaves the field closes the list, and puts the text of the selected item back in the input. `allowsCustomValue` keeps what was typed.

## Forms

`name` sends the key of the selected item with its form, also before the code of the page loads. A server error for the `name` in a [Form](./form.md) shows in the FieldError until the selection changes.

## How it filters

The items are on the page while the list is open, so the ComboBox hides those that do not match, and the keys skip hidden items. A section with no item left is hidden too. To filter the items yourself, such as from a server, bind `inputValue` and render only the items that you want in a `#for`.
