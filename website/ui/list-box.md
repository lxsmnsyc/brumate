# ListBox

A list of options that the user selects from, with the keyboard, a pointer or a screen reader.

```brm demo ListBoxDemo

```

- A `ListBox` holds `ListBoxItem` elements, each with an `id`, its key. Write them out, or render them from a `#for`.
- A ListBox can take `items`, each with an `id`, and an `item` template that renders a `ListBoxItem` for each, as a [Tree](./tree.md) does. With `rowHeight`, or in a [Virtualizer](./virtualizer.md), a vertical list renders only the items in view, and its keys read the data of all the items. `getTextValue` returns the text of an item for the letters that move to an item, for the items out of view. A list in a field, such as a ComboBox, renders all its items.
- `selectionMode` is `none`, the default, `single` or `multiple`. `selectedKeys` is the list of the keys of the selected items. See [State](./state.md).
- `disabledKeys`, or `isDisabled` on an item, keeps items from focus and selection.
- `disallowEmptySelection` keeps one item selected.
- A key is a string or a number, and stays one: `id=(2)` selects `2`, not `'2'`.
- Inside a [Select](./select.md), the Select keeps the selection, and a press picks one item.

## Anatomy

```brm anatomy ListBoxAnatomy
`ListBox`: Holds the items and the selection. It is a `listbox` and takes one stop of Tab.
`ListBoxSection`: Groups items. It is named by its Header, or by `aria-label`. Optional.
`Header`: Names the section.
`ListBoxItem`: One option. Its `id` is its key, and it shows `data-selected` when it is selected.
`Text` with `slot="label"`: Names an item whose content is more than text. The item needs `hasLabel`. Optional.
`Text` with `slot="description"`: Describes the item. The item needs `hasDescription`. Optional.
```

```html
<ListBox>
  <ListBoxSection>
    <Header />
    <ListBoxItem>
      <Text slot="label" />
      <Text slot="description" />
    </>
  </>
  <ListBoxItem />
</>
```

The sections, and the `Text` elements in an item, are optional. An item holds text, or a label and a description.

## Props

### ListBox

```props ListBox

```

### ListBoxItem

```props ListBoxItem

```

### ListBoxSection

```props ListBoxSection

```

### Header

```props Header

```

## Data attributes

### ListBox

| Attribute          | When                                                    |
| ------------------ | ------------------------------------------------------- |
| `data-orientation` | The value of `orientation`, `vertical` or `horizontal`. |

### ListBoxItem

| Attribute            | When                                               |
| -------------------- | -------------------------------------------------- |
| `data-selected`      | The item is selected.                              |
| `data-disabled`      | The item is disabled.                              |
| `data-pressed`       | A pointer or a key holds it down.                  |
| `data-hovered`       | A mouse or a pen is over it.                       |
| `data-focused`       | It has focus, or it is the active item of a field. |
| `data-focus-visible` | Its focus shows as a ring.                         |

## Keyboard

The keys act while an item has focus. With `orientation="horizontal"`, Left and Right replace Up and Down, and turn around right to left.

| Key                                      | Action                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Tab`                                    | Moves focus to the list, to the item that had focus last, else the first selected item, else the first item. |
| `ArrowDown` or `ArrowUp`                 | Moves focus to the next or the previous item.                                                                |
| `Home` or `End`                          | Moves focus to the first or the last item.                                                                   |
| `PageUp` or `PageDown`                   | Moves focus a page up or down.                                                                               |
| `Shift + ArrowDown` or `Shift + ArrowUp` | Selects a range, in a multiple selection.                                                                    |
| `Space`                                  | Toggles the item, or selects it with `selectionBehavior="replace"`.                                          |
| `Enter`                                  | Acts on the item when there is an action, and else selects it.                                               |
| `Ctrl + A` or `Meta + A`                 | Selects all the items that are not disabled, in a multiple selection.                                        |
| `Escape`                                 | Clears the selection, unless `escapeKeyBehavior="none"` or `disallowEmptySelection`.                         |
| `a` to `z`                               | Moves focus to the item whose text starts with what was typed.                                               |

## Controlled and uncontrolled

`selectedKeys` holds the keys of the selected items, as a list. How you pass it picks who keeps it. The lists here select several items:

```brm demo ListBoxStateDemo

```

- `selectedKeys` alone, or nothing, makes the list keep its own selection. `selectedKeys=(['cat'])` is where that selection starts. Pick another item and the list keeps the pick. A new value from you replaces it.
- `selectedKeys=$bind(signal)` writes your signal. Change the signal and the list follows.
- `selectedKeys=$bind(signal, (next) => ...)` asks you first. The list shows what you keep, so a request that you ignore leaves the old keys. Press Lock above and pick an item in the last list.
- `onSelectionChange` gets the keys after each change, in every shape.
- The list is read only with `selectionMode="none"`, the default.
- A ListBox is not a form field. It has no `name` and no reset, so a reset of a form leaves its selection as it is. The server renders the selection it starts with. See [State](./state.md).

## Styling

Style an item with the data attributes above, such as `[data-selected]` and `[data-focus-visible]`, and the list with `[data-orientation]`. See [Styling](./styling.md).

This stylesheet styles every state of an item: rest, hover, press, keyboard focus, selected, selected and hovered, selected and pressed, and disabled. Its tokens are at the top, and they follow the color scheme. Tab into the list and press the arrow keys, then Space.

```brm styled ListBoxStyled

```

## Use cases

### A filterable list

The list renders the items that match the text of a [SearchField](./search-field.md), from a `#for` over a derived list, with the key as `by`. The selection is a list of keys, so it stays when the item leaves the list. Typing in the list still moves focus to the item whose text starts with the letters, among the items that show.

```brm demo ListBoxFilterDemo

```

### A multiple selection with a toolbar

A [Toolbar](./toolbar.md) above the list holds the buttons that act on the selection. `Select all` writes every key into the bound signal, `Clear` empties it, and `Delete` removes the selected items from the data and clears the signal. Select a few folders, press Delete, then Restore.

```brm demo ListBoxToolbarDemo

```

## Items from data

Instead of writing the items out, pass `items` and an `item` template that renders a `ListBoxItem` for each. The template's parameter takes its type from `items`, so the template knows the fields of the item. A type on the parameter, such as `item: Animal`, is allowed too.

```html
<ListBox aria-label="Animals" items=animals item=row />

#template row(item) {
  <ListBoxItem id=(item.id)>{item.name}</ListBoxItem>
}
```

## Selection

- `selectionBehavior="toggle"`, the default, adds and removes items as checkboxes do. A press, Space and Enter toggle the item.
- `selectionBehavior="replace"` makes the item the selection, as a list of files does. The selection follows focus. Ctrl or Cmd adds an item, or moves focus alone with the arrow keys.
- In a multiple selection, Shift with a press or the arrow keys selects a range from the last item selected, or else from the item that has focus. Ctrl+A or Cmd+A selects all, other than disabled items.
- Escape clears the selection, unless `escapeKeyBehavior="none"` or `disallowEmptySelection`.
- `onSelectionChange` gets the keys after each change.

## Actions

With `selectionMode="none"`, a press or Enter acts on the item: `onAction` gets its key, and `onAction` on the item runs too. With a selection, Enter acts when the ListBox or the item has `onAction`, and selects when neither has.

## Focus and keys

- Tab stops at the list once. Focus goes to the item that had focus last, or else to the first selected item, or the first item.
- The arrow keys move focus, and Home, End, PageUp and PageDown go further. `orientation="horizontal"` uses Left and Right, which turn around right to left. `shouldFocusWrap` goes from the last item to the first.
- Typing moves to the item whose text starts with what was typed, in the second after each letter. `textValue` sets that text for an item whose content is more than text.
- With `items` in a windowed list, Home, End, the page keys, Ctrl+A, ranges with Shift and letters reach items that are out of view. A move to one scrolls it into view, then focuses it.
- The keys that move focus never scroll the page, also before the code of the list loads. The arrow keys of the other axis keep their default, such as Left and Right in a vertical list.

## Sections

`ListBoxSection` groups items, and a `Header` inside names the group. A section with no Header needs `aria-label`.

```html
<ListBoxSection>
  <Header>Birds</Header>
  <ListBoxItem id="kiwi">Kiwi</ListBoxItem>
</ListBoxSection>
```

## Items

- An item is an `option`. It shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused` and `data-focus-visible`.
- A `Text` with `slot="label"` names an item, and one with `slot="description"` describes it. A part cannot read its children, so add `hasLabel` and `hasDescription` to the item that has them.
- An item with `hasDescription` and no `hasLabel` is named by its whole content, the description included, and the description is read again as its description. Give such an item a label.
- The list shows `data-orientation`.
- An option is read as one piece of text, so it holds no fields or buttons. The list takes the keys of a field inside. A [GridList](./grid-list.md) holds rows with controls.

## How it reads the items

A part of brumate cannot read its children, so the ListBox reads its items from the page: each item writes its key in `data-key`, and the order of the items is the order of their elements. This is why items can come from any markup, a `#for` or sections, with no `items` prop. A list that renders only the items in view has no page to read, so it takes `items` and reads their data.
