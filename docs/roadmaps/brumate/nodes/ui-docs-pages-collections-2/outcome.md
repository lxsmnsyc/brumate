# Outcome: ui-docs-pages-collections-2

## Built

Three of the eight pages of the node: Menu, ComboBox and Autocomplete. The node stays `active` for the other five.

The PR stops here because each page needs an anatomy picture, a styled example, two use cases and a state demo, which is 15 new demo files for three pages. The three parts share one behavior to check (a list that opens or filters while focus moves or stays in a field), so they are one review. Table, Tree, NavigationTree, Virtualizer and Data are large or need their own data, and are better reviewed in a third PR.

| Page         | Anatomy             | Use cases                                                                                           | Styled             | Controlled and uncontrolled                                                                           |
| ------------ | ------------------- | --------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| Menu         | MenuAnatomy         | actions on a row (a trigger for each row), choices that stay open (multiple selection, single sort) | MenuStyled         | MenuStateDemo: `isOpen` own, `$bind`, `$bind` with a setter, and a `selectedKeys` menu                |
| ComboBox     | ComboBoxAnatomy     | a required field in a form with a reset, a name that is not on the list (`allowsCustomValue`)       | ComboBoxStyled     | ComboBoxStateDemo: four shapes, a Write button and a form reset                                       |
| Autocomplete | AutocompleteAnatomy | a command palette in a dialog, a ListBox with a selection and a `filter`                            | AutocompleteStyled | AutocompleteStateDemo: own, own copy, `$bind`, `$bind` with a setter. No write from code (bug below). |

- Every claim was read against packages/ui/src and clicked through in Chrome (see below). The pages say that Menu and Autocomplete are not form fields and that ComboBox is one.
- Each styled example has rest, hover, press, keyboard focus as two bands, open, disabled, selected where it applies, and the closed look of the overlay. Colors use `light-dark()` and system colors. Every class has a prefix of its own (`menu-styled-`, `combo-styled-`, `auto-styled-`).
- The ComboBox and Autocomplete pictures draw the Input through a wrapper that carries the badge. The Menu picture draws two menus in place, and puts the Separator in a wrapper. The Autocomplete picture lists only the items that match its text, since the picture is inert and does not filter.
- One change to website/src/routes/ui/_layout.brm: `.ui-menu-item[hidden]` is `display: none`. The class has `display: flex`, which overrode the `hidden` attribute that the filter of an Autocomplete sets, so the existing Autocomplete demo showed every item while the user typed.
- e2e/suites/website.mjs: the Collections flow takes the three slugs (CSS shows, callouts equal the listed pieces, axe finds nothing on the article, with the one accepted exclude). A new flow uses the pages: ArrowDown and Enter on a row menu, focus back on the Button, a menu that follows its signal, a multiple selection that stays open, a ComboBox pick, an error and a reset, and the palette filter and action.
- #332 (refused writes) landed while this node was in progress, and it does not touch Menu, ComboBox or Autocomplete. The pages describe main after it. State lists ComboBox as showing the key that you keep. That holds for the key and the hidden input, and bug (c) below is about the text of the input.

## Checked in Chrome

- Menu state demo: the trigger of a bound `isOpen` writes the signal on press and on Escape, and a write from a button opens and closes the menu. A refused `isOpen` (Lock, then press or ArrowDown) leaves the menu closed and `aria-expanded` false. Lock cannot be pressed while the menu is open, since a press outside closes it first, so the demo does not show a refused close.
- Row menus: Move to top, Duplicate and Delete change the list and the message, and focus goes back to the Button of the row. After Delete the Button is gone and focus goes to the page. The page says so.
- Choices that stay open: a checkbox item keeps the menu open and changes the list, and a single sort closes it. A second press of the checked radio item with `disallowEmptySelection` keeps it checked.
- ComboBox: typing filters, ArrowDown opens with all the items, Enter picks and a second Enter sends the form, Reset clears the text and key and closes the list, `allowsCustomValue` keeps a guest name and clears the key on an edit, `menuTrigger="focus"` opens on focus.
- Autocomplete: the palette opens with the field focused (`autofocus` on the Input, the Dialog alone takes focus otherwise), typing hides the items that do not match, the first match is active, ArrowDown and Enter run the next one, and the dialog closes with focus back on its Button. A fresh palette opens with an empty field and all the items. The ListBox with `filter` keeps a selected item that is filtered out.

## Part bugs found, not fixed here

Each is its own fix from main.

- (a) ComboBox and Select hide a server error that arrives after the user picks an item. `edited` in ComboBox.brm and Select.brm becomes true at the pick and is cleared only by a form reset, so `validationErrors` of a Form for the field's `name` show only before the first pick. The Form page says a field shows them until the user edits it. The page says so, and the demos use `isInvalid` with a message in the FieldError.
- (b) ComboBox does not show the message of the browser for `isRequired`. The browser blocks the submit and shows its own bubble on the input, and the FieldError stays empty (Select copies it). The page says so.
- (c) A refused `selectedKey` leaves the picked text in the input of a ComboBox, while the key stays the old one. The text is a state of its own, and the page says so.
- (d) A write from code to a bound `inputValue` of an Autocomplete does not change the filter. `filterText` follows only the typing (the `input` event, Escape and a press), and the field shows the new text with every item hidden. The page says to use the signal to read the text.
- (e) Pressing Enter or ArrowUp, then a key, in the same millisecond as a Menu or a Dialog opens sends the key before focus is inside, so it is lost. A person cannot type that fast, so it is a note and not a bug of use.

## Deviations

- The brief lists eight pages. Five are left (below).
- Screenshots: Menu, ComboBox and Autocomplete, anatomy and styled, in both themes, and the open styled blocks of Menu and ComboBox. No Table screenshot, since the Table page is not in this PR.
- Contrast was measured in Chrome in both themes, with the site toggle against the system setting, for every state of the three styled examples. The numbers are in the PR description.
- `brumate check` reports BRM167 on website/ui/demos/DataDemo.brm ("Cannot read @brumate/ui/data.brm.ts"), as on main. The Data page is not in this PR, so it does not block this one. It will block `check` for the Data page.

## Stubs left

- The five pages: table, tree, navigation-tree, virtualizer, data.

## Notes for the next pages

- A `MenuTrigger`, a `SubmenuTrigger` and an `Autocomplete` render an element with `display: contents`, so they cannot carry a badge. Say so under the picture.
- A class with `display: flex` on an item overrides the `hidden` attribute that a filter sets. Add a `[hidden]` rule for the class, or avoid `display` on an item that a filter can hide.
- A Dialog moves focus to the dialog itself, not to the first field. Put `autofocus` on the Input of a palette.
- A page with several demos of one part repeats `aria-label` and text such as "Last command". A test that reads a paragraph by its text must be scoped to its demo.
