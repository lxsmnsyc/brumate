# Outcome: ui-docs-pages-layout

## Built

Seven of the thirteen pages: Disclosure, DisclosureGroup, Breadcrumbs, Toolbar, Meter, ProgressBar and Group. They are the ones with pieces, state or keys. The node stays `active` for the other six.

| Page            | Anatomy                                  | Use cases                                                            | Styled                                              | Controlled and uncontrolled                                           |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Disclosure      | DisclosureAnatomy                        | terms that must be opened, options that keep their state             | DisclosureStyled                                    | DisclosureStateDemo: own, start value, `$bind`, `$bind` with a setter |
| DisclosureGroup | DisclosureGroupAnatomy                   | expand all and collapse all, checkout steps that open in turn        | DisclosureGroupStyled                               | DisclosureGroupStateDemo, the same four shapes                        |
| Breadcrumbs     | BreadcrumbsAnatomy                       | a folder path the user walks, a trail disabled while a form is dirty | BreadcrumbsStyled                                   | skipped, no state; the page says so                                   |
| Toolbar         | ToolbarAnatomy                           | a formatting bar with a field, right to left in Arabic               | ToolbarStyled (horizontal and vertical)             | skipped, no value; the page says where the tab stop lives             |
| Meter           | MeterAnatomy                             | units and words, a value that changes                                | MeterStyled (levels in a `content` template)        | skipped, no state                                                     |
| ProgressBar     | ProgressBarAnatomy                       | an upload that cancels, steps and an indeterminate wait              | ProgressBarStyled (determinate, indeterminate)      | skipped, no state                                                     |
| Group           | GroupAnatomy (Input marked by a wrapper) | a quantity with buttons, a search field with a button                | GroupStyled (rest, hover, focus, invalid, disabled) | skipped, no state                                                     |

- Every claim was read against packages/ui/src and clicked through in Chrome (below).
- Styled examples use `light-dark()` and system colors, a two-band focus ring with `outline: none`, and `prefers-reduced-motion`. Every class has a prefix of its own. No change to website/src/routes/ui/_layout.brm.
- Contrast was measured in Chrome in light and dark: text 4.5:1 or more in every state (the lowest is the white text on the accent, 4.85). Rings and borders that are the only mark are 3:1 or more: the group border (3.36 light, 4.55 dark), the accent (4.85, 8.20), the meter and progress fills on their tracks (3.17 to 5.7). The card borders of the two disclosure examples were 1.83 and 2.47 at first, and are now 45% of the text color.
- Two e2e flows in e2e/suites/website.mjs. One is static for the seven pages in both schemes (CSS shows, callouts equal the listed pieces, axe finds nothing; `.props-table` is excluded for the known `scrollable-region-focusable`, delete the exclude when ui-scroll-focus lands). The other interacts: Continue closes step 1 and opens step 2, Enter on the terms wakes Accept, the toolbar arrows, Home, End and Shift+Tab, ArrowLeft in Arabic, two quick presses on Upload run one timer, and Cancel resets. It was checked to fail: a Continue that leaves step 1 open gives "step 1 stayed open".

## Skipped, and why

- Breadcrumbs, Toolbar, Meter, ProgressBar, Group have no state section of their own. Each page has a short State section that says why, what a form reset does (nothing) and what the server renders.

## Stubs left

Separator, Heading, Transition, VisuallyHidden, Keyboard, I18nProvider. What each should get:

- Separator: a styled example (both orientations) and one use case. No anatomy, no state.
- Heading: no anatomy and no styled example. A use case inside a Dialog title, and the `slot` idea.
- Transition: a styled example and a use case with `show`, `appear` and `unmount`. TransitionChild anatomy.
- VisuallyHidden: a use case (icon button name, skip link with `focusable`). No anatomy.
- Keyboard: a use case of a shortcut list, right to left. No anatomy, no state.
- I18nProvider: use cases of a locale switch (number format, Toolbar keys, date parts). No anatomy, no styling.

## Checked in Chrome

- Disclosure: all four shapes. A press, a write to the signal, a refused request (Lock) and five quick clicks on one trigger. `onExpandedChange` runs for a press and not for a write. Enter and Space toggle. `unmount="offscreen"` keeps the typed text across a collapse.
- DisclosureGroup: one open at a time, a refused request keeps the signal, expand all and collapse all, Continue.
- Breadcrumbs: Link without `href` runs `onPress` with the mouse and with Enter, the path cuts back, `isDisabled` turns the links into spans.
- Toolbar: ArrowRight, End and Home, Home from a field stays in the field, the caret keys stay in the field, Shift+Tab leaves the toolbar (the tab stop is one item), right to left turns the keys around, a vertical toolbar uses ArrowUp and ArrowDown and ignores ArrowRight.
- ProgressBar: a double click on Upload starts one timer, Cancel then Upload does not double the speed, Upload again after 100, step text and `--percentage`, `isIndeterminate` on and off.

## Part bugs and gaps found

None is fixed here.

- A `style` on Meter or ProgressBar replaces the `--percentage` that they set, because the spread of the rest props comes after `style`. The bar then shows no fill. The two pages say so now. A fix: merge the two styles.
- A Button that disables itself while it has focus (a size button at its limit) drops focus to the page, as the browser does for any disabled button. In a Toolbar, the next Tab then starts at the top of the page. The page says so, and the demo clamps instead of disabling.
- Group does not pass `isDisabled` to the parts in it, so the disabled example sets `disabled` on the Input and `isDisabled` on the Button itself.

## Flake seen

The overlays flow ("Escape left the tooltip") failed in about half of the runs while other workers loaded the machine, and passed when rerun. It is not in this diff.
