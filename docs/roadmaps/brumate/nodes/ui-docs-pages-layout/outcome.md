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
- Contrast was measured in Chrome in light and dark: text 4.5:1 or more in every state (the lowest is the white text on the accent, 4.85). Rings and borders that are the only mark are 3:1 or more against the stage behind them (`--surface`, #f2efea in light), not against Canvas: the borders of Group, Disclosure and DisclosureGroup are 50% of the text color, which is about 3.45:1 in light and above 4.5:1 in dark. The accent is 4.85 (light) and 8.20 (dark) on Canvas, and the meter and progress fills are 3.17 to 5.7 on their tracks. A first version used 45% and, against the stage, gave 2.93:1.
- Two e2e flows in e2e/suites/website.mjs. One is static for the seven pages in both schemes (CSS shows, callouts equal the listed pieces, axe finds nothing). The other interacts and checks: Continue closes step 1, opens step 2 and moves focus to its trigger; a styled DisclosureGroup (no `allowsMultipleExpanded`) keeps one item open after presses on the triggers, and the expand-all group adds up; Accept keeps focus when pressed; `unmount="offscreen"` keeps typed text; the toolbar arrows, Home, End, Shift+Tab and ArrowLeft in Arabic; Upload and Cancel keep focus and two quick presses run one timer; the ProgressBar and Meter fills are 64% and 72% wide; a Breadcrumbs press cuts the path and moves focus to the list of folders; Group shows `data-disabled`, `data-invalid` and `data-focus-within`; Enter in the search field searches. It was checked to fail: a Continue that leaves step 1 open gives "step 1 stayed open".

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
- A Button that disables itself while it has focus drops focus to BODY, as the browser does for any disabled button. Chrome keeps the sequential focus point, so the next Tab continues from where the button was. The demos (Upload and Cancel, the steps bar, the battery, the quantity, Accept, the folder trail, the checkout steps) clamp, ignore a press, or move focus on purpose.
- Toolbar: until focus first enters it, every item is in the order of Tab (tabIndex `[0,0,0,0]`), and the roving tab stop starts at the first focus. The page now says so. A part gap: a toolbar could start with one stop.
- Group does not pass `isDisabled` to the parts in it, so the disabled example sets `disabled` on the Input and `isDisabled` on the Button itself.

## Flake seen

The overlays flow ("Escape left the tooltip") failed in about half of the runs while other workers loaded the machine, and passed when rerun. It is not in this diff.
