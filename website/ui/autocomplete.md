# Autocomplete

A search field that filters a Menu or a ListBox next to it, such as for a list of commands.

```brm demo AutocompleteDemo

```

```html
<Autocomplete>
  <SearchField>
    <Label>Commands</Label>
    <Input />
  </SearchField>
  <Menu aria-label="Commands" onAction=((key) => run(key))>
    <MenuItem id="new">New file</MenuItem>
    <MenuItem id="open">Open file</MenuItem>
  </Menu>
</Autocomplete>
```

- An `Autocomplete` holds a [SearchField](./search-field.md) or a [TextField](./text-field.md), and a [Menu](./menu.md) or a [ListBox](./list-box.md). It renders only its children.
- `inputValue` is the text of the field. It starts its own state, or binds with `$bind`, and `onInputChange` gets each change.

## Filtering

- Typing shows the items whose text contains what was typed, in any case, and makes the first one active. A section with no item left is hidden.
- `filter` decides when an item matches, such as `(text, input) => text.startsWith(input)`.
- When the field is cleared, such as with Escape or the Button of a SearchField, all the items show again.

## Keyboard

- Focus stays in the field. ArrowDown and ArrowUp move through the items, and go round at the ends. `aria-activedescendant` on the input names the active item, and `aria-controls` names the collection.
- The pointer makes an item active.
- Enter presses the active item. A Menu acts on it, and a ListBox selects it or acts on it, as a press does.
- The collection is out of the order of Tab, since the field moves through it.

A submenu does not open from the field.
