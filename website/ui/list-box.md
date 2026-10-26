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

## Selection

- `selectionBehavior="toggle"`, the default, adds and removes items as checkboxes do. A press, Space and Enter toggle the item.
- `selectionBehavior="replace"` makes the item the selection, as a list of files does. The selection follows focus. Ctrl or Cmd adds an item, or moves focus alone with the arrow keys.
- In a multiple selection, Shift with a press or the arrow keys selects a range from the last item selected, or else from the item that has focus. Ctrl+A or Cmd+A selects all, other than disabled items.
- Escape clears the selection, unless `escapeKeyBehavior="none"` or `disallowEmptySelection`.
- `onSelectionChange` gets the keys after each change.

## Actions

With `selectionMode="none"`, a press or Enter acts on the item: `onAction` gets its key, and `onAction` on the item runs too. With a selection, Enter acts when the ListBox or the item has `onAction`, and selects when neither has.

## Keyboard

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
- The list shows `data-orientation`.
- An option is read as one piece of text, so it holds no fields or buttons. The list takes the keys of a field inside, as in React Aria. A [GridList](./grid-list.md) holds rows with controls.

## How it reads the items

React Aria reads the items from the children of the list. A part of brumate cannot read its children, so the ListBox reads its items from the page: each item writes its key in `data-key`, and the order of the items is the order of their elements. This is why items can come from any markup, a `#for` or sections, with no `items` prop. A list that renders only the items in view has no page to read, so it takes `items` and reads their data.
