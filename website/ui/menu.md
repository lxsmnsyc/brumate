# Menu

A list of actions or options that opens from a button, with the keyboard, a pointer or a screen reader.

```brm demo MenuDemo

```

```html
<MenuTrigger>
  <Button>Edit</Button>
  <Popover>
    <Menu onAction=((key) => run(key))>
      <MenuItem id="cut">Cut</MenuItem>
      <MenuItem id="copy">Copy</MenuItem>
    </Menu>
  </Popover>
</MenuTrigger>
```

- A `MenuTrigger` holds a `Button` and a `Popover` with a `Menu`. The Button gets `aria-haspopup="menu"`, `aria-expanded` and `aria-controls`, and the Menu is named by it.
- A `Menu` holds `MenuItem` elements, each with an `id`, its key. Write them out, or render them from a `#for`.
- `onAction` on the Menu gets the key of the item, and `onAction` on the item runs too.
- `disabledKeys`, or `isDisabled` on an item, keeps items from focus and action.
- `isOpen` alone starts the menu open, and `isOpen=$bind(signal)` writes the caller's. `onOpenChange` gets each change.

## Opening and closing

- A press of the Button opens the menu. From a key, focus goes to the first item. From a pointer, focus goes to the menu, and an arrow key moves to an item.
- ArrowDown on the Button opens the menu at its first item, and ArrowUp at its last.
- An action closes the menu, and focus goes back to the Button. `shouldCloseOnSelect=(false)` keeps it open.
- Escape, Tab and a press outside close it too.

## Keyboard

- The arrow keys move focus, and go from the last item to the first. `shouldFocusWrap=(false)` stops at the ends.
- Home and End move to the first and the last item.
- Enter and Space act on the item that has focus.
- Typing moves to the item whose text starts with what was typed, in the second after each letter. `textValue` sets that text for an item whose content is more than text.
- The pointer moves focus to the item under it, as a menu of the system does.

## Selection

`selectionMode="single"` makes the items radios, and `"multiple"` checkboxes. Each item is then a `menuitemradio` or a `menuitemcheckbox`, with `aria-checked`.

- `selectedKeys` is the list of the keys of the checked items. See [State](./state.md).
- `onSelectionChange` gets the keys after each change.
- A single selection closes the menu. A multiple selection keeps it open, so several items can change.
- `disallowEmptySelection` keeps one item checked.

## Submenus

A `SubmenuTrigger` holds a `MenuItem` and a `Popover` with the Menu of the submenu.

```html
<SubmenuTrigger>
  <MenuItem id="share">Share</MenuItem>
  <Popover>
    <Menu onAction=((key) => share(key))>
      <MenuItem id="email">Email</MenuItem>
    </Menu>
  </Popover>
</SubmenuTrigger>
```

- The item gets `aria-haspopup="menu"` and `aria-expanded`.
- A press, Enter, Space or ArrowRight opens the submenu, with focus on its first item. Right to left, ArrowLeft opens it.
- The pointer resting on the item opens it after `delay`, 200 milliseconds by default, and focus stays on the item.
- ArrowLeft and Escape close it, and focus goes back to the item. Focus that moves to another item of the parent menu closes it too.
- The submenu is not modal, so the parent menu stays usable. It is placed at the end of the item, with its top at the top of the item.
- An action in the submenu closes every menu.

## Sections

`MenuSection` groups items, and a `Header` inside names the group. A section with no Header needs `aria-label`. A `Separator` draws a line between items.

## Items

An item shows `data-selected`, `data-disabled`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, and `data-open` while its submenu is open. A `Text` with `slot="label"` names it, and one with `slot="description"` describes it, with `hasLabel` and `hasDescription` on the item.

A Menu reads its items from the page, as a [ListBox](./list-box.md) does. A Menu that stands on the page, with no trigger, takes Tab once and passes focus to its first item.
