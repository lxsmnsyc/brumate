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

## Anatomy

```html
<MenuTrigger>
  <Button />
  <Popover>
    <Menu>
      <MenuSection>
        <Header />
        <MenuItem>
          <Text slot="label" />
          <Text slot="description" />
        </>
      </>
      <Separator />
      <SubmenuTrigger>
        <MenuItem />
        <Popover>
          <Menu />
        </>
      </>
    </>
  </>
</>
```

The sections, the Separator, the submenus and the `Text` elements are optional. A Menu can also stand on the page with no trigger.

## Props

### MenuTrigger

```props MenuTrigger

```

### Menu

```props Menu

```

### MenuItem

```props MenuItem

```

### MenuSection

```props MenuSection

```

### SubmenuTrigger

```props SubmenuTrigger

```

## Data attributes

| Attribute            | When                                             |
| -------------------- | ------------------------------------------------ |
| `data-selected`      | The item is checked, in a menu with a selection. |
| `data-disabled`      | The item is disabled.                            |
| `data-pressed`       | A pointer or a key holds it down.                |
| `data-hovered`       | A mouse or a pen is over it.                     |
| `data-focused`       | It has focus.                                    |
| `data-focus-visible` | Its focus shows as a ring.                       |
| `data-open`          | Its submenu is open.                             |

These are the attributes of a `MenuItem`. The `Button` of the trigger shows [its own](./button.md#data-attributes), and the `Popover` [its own](./popover.md).

## Keyboard

| Key                | Action                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `Tab`              | Moves focus to the Button, or to the first item of a Menu with no trigger. In an open menu, it closes the menu. |
| `Enter` or `Space` | On the Button, opens the menu at its first item. On an item, acts on it.                                        |
| `ArrowDown`        | On the Button, opens the menu at its first item. In the menu, moves to the next item.                           |
| `ArrowUp`          | On the Button, opens the menu at its last item. In the menu, moves to the previous item.                        |
| `Home` or `End`    | Moves focus to the first or the last item.                                                                      |
| `ArrowRight`       | On an item with a submenu, opens it. Right to left, `ArrowLeft` does.                                           |
| `ArrowLeft`        | In a submenu, closes it. Right to left, `ArrowRight` does.                                                      |
| `Escape`           | Closes the menu and puts focus back on the Button. In a submenu, closes only the submenu.                       |
| `a` to `z`         | Moves focus to the item whose text starts with what was typed.                                                  |

## Controlled and uncontrolled

`isOpen` on the `MenuTrigger` holds whether the menu is open. `isOpen` alone holds its own state, which starts closed, and `isOpen=$bind(signal)` writes your signal. A start value of `true` does not open the menu on load: an [effect never runs when the page loads](../docs/effects.md), and the menu opens from an effect. `onOpenChange` gets each change. `selectedKeys` on the `Menu` holds the checked items in a menu with `selectionMode`, and starts its own state or binds with `$bind`. `onSelectionChange` gets the keys after each change. See [State](./state.md).

## Styling

Style an item with the data attributes above, such as `[data-focused]` and `[data-open]`. The position and the size of the menu belong to its [Popover](./popover.md). See [Styling](./styling.md).

## Opening and closing

- A press of the Button opens the menu. From a key, focus goes to the first item. From a pointer, focus goes to the menu, and an arrow key moves to an item.
- ArrowDown on the Button opens the menu at its first item, and ArrowUp at its last.
- An action closes the menu, and focus goes back to the Button. `shouldCloseOnSelect=(false)` keeps it open.
- Escape, Tab and a press outside close it too.

## Focus and keys

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
