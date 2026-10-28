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

```brm anatomy AutocompleteAnatomy
`SearchField`: The field. It holds the text, and it is a form field of its own.
`Label`: Names the field.
`Input`: Holds the text. Focus stays here, and `aria-activedescendant` names the active item. The badge is on a wrapper.
`Button`: Clears the field. It is out of the order of Tab. Optional.
`Menu`: The collection that the text filters. It is out of the order of Tab.
`MenuItem`: One command. It shows only while its text matches.
```

```html
<Autocomplete>
  <SearchField>
    <Label />
    <Input />
    <Button />
  </>
  <Menu>
    <MenuItem />
  </>
</>
```

The `Autocomplete` renders no element of its own, so it has no number. The picture holds the text `fi`, and its Menu lists only the items that match it. The collection can be a `ListBox` in place of the `Menu`, and the field a `TextField` in place of the `SearchField`.

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
| `a` to `z`  | Types in the field, which filters the items.                                     |

## Controlled and uncontrolled

`inputValue` holds the text that filters the items. How you pass it picks who keeps it:

```brm demo AutocompleteStateDemo

```

- `inputValue` alone, or nothing, makes the Autocomplete keep its own text. `inputValue=('open')` is where it starts, and the field needs the same text in its `value`, since the field holds the text that the user sees.
- `inputValue=$bind(signal)` writes your signal with each change of the text. A write from your code does not change the text of the field or the items that show, so use the signal to read the text, not to set it.
- `inputValue=$bind(signal, (next) => ...)` asks first. A request that you ignore leaves the old text in the signal, and the field and the items still follow the typing. Press Lock and type in the last field.
- `onInputChange` gets the text after each change, in every shape.
- An Autocomplete is not a form field. It has no `name` and no reset handler, so a reset of a form does not write its `inputValue`. The SearchField or the TextField inside is a form field of its own. See [State](./state.md#form-reset).

## Styling

The Autocomplete has no element to style. Style the field and the collection inside with their own data attributes. See [Styling](./styling.md).

This stylesheet styles the field, its clear button and the Menu: rest, hover, focus inside the field, an empty field, and the items with hover, press, the active item and disabled. Its tokens are at the top, and they follow the color scheme. Focus stays in the field, so the active item shows `data-focused`. Type `fi`, then press the arrow keys and Enter.

```brm styled AutocompleteStyled

```

## Use cases

### A command palette in a dialog

An Autocomplete in a Dialog of a Modal gives a palette. The Dialog takes focus when it opens, so the Input has `autofocus` to move it to the field. The arrow keys and Enter act on the commands while focus stays in the field. The action closes the dialog through the signal of the `DialogTrigger`.

```brm demo AutocompletePaletteDemo

```

### A ListBox that picks several

The collection can be a ListBox with a selection, and `filter` changes the match. This one matches the start of a name. Typing filters the list, and Enter or a press selects the active item. A selected item that is filtered out stays selected.

```brm demo AutocompleteFilterDemo

```

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
