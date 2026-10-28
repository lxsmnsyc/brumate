# Outcome: ui-docs-pages-collections

## Built

The Collections group, four of the twelve pages of the node: ListBox, Tabs, TagGroup and GridList. The pages of Menu, ComboBox, Autocomplete, Table, Tree, NavigationTree, Virtualizer and Data are not done. The node stays `active` for them.

The PR stops here because each page needs an anatomy picture, a styled example, two use cases and a state demo, which is 20 new demo files for four pages. The eight pages left are mostly overlays (Menu, ComboBox, Autocomplete) or large (Table, Tree), and are better reviewed in a second PR.

| Page     | Anatomy         | Use cases                                                                               | Styled         | Controlled and uncontrolled                                                   |
| -------- | --------------- | --------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| ListBox  | ListBoxAnatomy  | filterable list with a SearchField, multiple selection with a Toolbar                   | ListBoxStyled  | ListBoxStateDemo, four shapes (own, own copy, `$bind`, `$bind` with a setter) |
| Tabs     | TabsAnatomy     | steps in order (`disabledKeys` and a bound key), fields in a panel (`shouldForceMount`) | TabsStyled     | TabsStateDemo, four shapes                                                    |
| TagGroup | TagGroupAnatomy | tags that filter a list, tags that the user adds and removes                            | TagGroupStyled | TagGroupStateDemo, four shapes                                                |
| GridList | GridListAnatomy | rows with actions on the selection, a playlist that reorders with `onAction`            | GridListStyled | GridListStateDemo, four shapes                                                |

- Every claim was read against packages/ui/src. ListBox, Tabs, TagGroup and GridList are not form fields and have no reset handler (state.md says so), and the pages say so and link to state.md.
- Each styled example has rest, hover, press, keyboard focus, selected, selected and hovered, selected and pressed, and disabled states, with a two-band focus ring that shows on a selected fill. Colors use `light-dark()`. Every class has a prefix of its own (`listbox-styled-`, `tabs-styled-`, `tags-styled-`, `gridlist-styled-`).
- One e2e flow in e2e/suites/website.mjs covers the four pages in both schemes: the CSS shows, the callouts equal the listed pieces, and axe finds nothing. The flow turns off `scrollable-region-focusable`, which list-box and grid-list fail on main (node ui-scroll-focus). Delete that line when the node lands.
- The ListBox picture and styled example give an item a description, not a label and a description. An item with both is named by its label alone, and axe reports the experimental `label-content-name-mismatch` on it when the list is visible. The page text still explains the label slot.
- The sidebar flow still fails on main's `scrollable-region-focusable` for calendar, list-box, grid-list and tree. The new demos add no other violation. The first `/docs/control-flow` flow failed once with a network `Not connected` console error, and is not in these pages.
- No change to website/src/routes/ui/_layout.brm. The demos use its existing classes, and a few inline styles in the anatomy pictures.

## Checked in Chrome

- ListBox filter: the list narrows as text is typed, the selection stays when its item is filtered out, and an empty result shows a message instead of an empty listbox.
- ListBox toolbar: Select all, Clear, a double Delete and Restore keep the counts right.
- Tabs steps: two fast presses of Next stop at the last step, Back goes back, later tabs stay disabled until reached.
- Tabs fields: a field in a panel that is not forced starts empty when its tab returns, and the forced one keeps its text.
- TagGroup edit: a duplicate text, in any case, is skipped, and Enter twice adds one tag. Delete removes the focused tag, and so does the × button.
- GridList: the bulk delete and the row delete keep the selection free of keys of rows that are gone, a press plays a row, and removing the playing row clears it.

## Deviations

- The brief asked for about a dozen pages. Eight are left.
- Screenshots: Tabs, TagGroup and GridList, anatomy and styled, in both themes, and the styled ListBox in dark.

## Stubs left

- The eight pages: menu, combo-box, autocomplete, table, tree, navigation-tree, virtualizer, data.

## Notes for the next pages

- A part with `overflow` clips its own badge. Wrap it in an element with `data-mark`, or use `data-mark-side="inside"` for pieces within.
- A block piece such as a Header or a Text spans the width, so a badge with `data-mark-side="after"` falls outside. Give it `justify-self: start` or `width: fit-content` in the picture.
- A `SelectionIndicator` is `position: absolute`, and the anatomy rule sets `position: relative` on a marked piece. Set `style="position: absolute"` on the indicator in the picture.
- A Tabs picture needs a TabPanel for the selected tab, or `aria-controls` of the tab points at nothing.
