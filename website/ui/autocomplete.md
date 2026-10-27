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

## Anatomy

```html
<Autocomplete>
  <SearchField>
    <Label />
    <Input />
  </>
  <Menu>
    <MenuItem />
  </>
</>
```

The collection can be a `ListBox` in place of the `Menu`, and the field a `TextField` in place of the `SearchField`.

## Props

```props Autocomplete

```

## Data attributes

An Autocomplete renders only its children, so it sets no data attributes. The field and the collection inside show [their own](./search-field.md#data-attributes), and so do the [items of a Menu](./menu.md#data-attributes).

## Keyboard

Focus stays in the field. `aria-activedescendant` on the input names the active item.

| Key         | Action                                                                           |
| ----------- | -------------------------------------------------------------------------------- |
| `Tab`       | Moves focus to the field. The collection is skipped.                             |
| `ArrowDown` | Makes the next item active, round the ends.                                      |
| `ArrowUp`   | Makes the previous item active, round the ends.                                  |
| `Enter`     | Presses the active item. A Menu acts on it, and a ListBox selects or acts on it. |
| `Escape`    | In a SearchField, clears the field, and then all the items show again.           |
| A letter    | Types in the field, which filters the items.                                     |

## Controlled and uncontrolled

`inputValue` holds the text of the field. `inputValue=(text)` starts its own state, and `inputValue=$bind(signal)` writes your signal. `onInputChange` gets each change. The selection belongs to the Menu or the ListBox inside. See [State](./state.md).

## Styling

The Autocomplete has no element to style. Style the field and the collection inside with their own data attributes. See [Styling](./styling.md).

## Filtering

- Typing shows the items whose text contains what was typed, in any case, and makes the first one active. A section with no item left is hidden.
- `filter` decides when an item matches, such as `(text, input) => text.startsWith(input)`.
- When the field is cleared, such as with Escape or the Button of a SearchField, all the items show again.

## Focus and keys

- Focus stays in the field. ArrowDown and ArrowUp move through the items, and go round at the ends. `aria-activedescendant` on the input names the active item, and `aria-controls` names the collection.
- The pointer makes an item active.
- Enter presses the active item. A Menu acts on it, and a ListBox selects it or acts on it, as a press does.
- The collection is out of the order of Tab, since the field moves through it.

A submenu does not open from the field.
