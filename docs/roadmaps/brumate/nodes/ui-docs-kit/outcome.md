# Outcome: ui-docs-kit

## Built

- An anatomy block and a styled-example block for the pages of website/ui, with components website/src/components/AnatomyFigure.brm and StyledExample.brm. website/plugins/markdown.ts reads two new fences and DocPage.brm draws them.
- website/ui/styling.md: a styled example per kind (button, field, collection, overlay), transitions, dark mode.
- website/ui/state.md: the four shapes live, change callbacks, form reset, the server render, and a table of the state props of every part.
- website/ui/select.md: the anatomy picture, a styled example, controlled and uncontrolled with a live demo, and two use cases (a form with validation, sections with descriptions).
- e2e/suites/website.mjs: one flow for /ui/select in light and dark.

## How to write a page (for ui-docs-pages-*)

### Anatomy picture

Put it first under `## Anatomy`, above the `html` tag tree. The fence names a demo in website/ui/demos, and its body is one line for each piece, in the order of the tags:

````md
```brm anatomy SelectAnatomy
`Label`: Names the field.
`Button`: Opens the list.
```
````

The demo `SelectAnatomy.brm` renders the part closed, with the real classes of the site (`ui-select`, `ui-button`, ...). Mark each piece with `data-mark="N"`, which is its number in the list. CSS draws the badge on the piece, so it stays on it at any width, in both themes. Options for a mark:

- `data-mark-side="after"`: the badge follows the text, for a label, a description or a value.
- `data-mark-side="inside"`: the badge sits inside the right edge, for an item of a list that clips.
- No side: the badge is on the upper right corner.

A Popover renders in a layer at the end of `<body>`, so draw its list in place: a `<div class="anatomy-popover" data-mark="N">` around a real `ListBox`. The picture is inert and has `role="img"` with a label, so a screen reader reads the numbered list under it. Do not use `<Mark>` elements or text in the badges.

### Styled example

````md
```brm styled SelectStyled
```
````

The demo is a part with a full stylesheet in its own `<style>` block, so the page shows the live result and the source, markup and CSS together. Rules:

- Give every class of the demo a prefix of its own (`pick-`, `sb-`, `sf-`, `sl-`, `so-`). Never reuse a class of another demo.
- Style rest, hover (`data-hovered`), press, `data-focus-visible`, open, invalid, disabled, selected, and the closed look of an overlay.
- Keep colors in custom properties on the root class, with a dark override in `@media (prefers-color-scheme: dark)`. Put them on the overlay class too, since an overlay is a layer outside the root.
- Add `@media (prefers-reduced-motion: reduce)` for transitions.

### State section

Under `## Controlled and uncontrolled`, give a live demo of the shapes that the part has (own, own copy, `$bind`, `$bind` with a setter), then one bullet each for when to use it, the change callbacks, the form reset and the server render. SelectStateDemo is the model.

### Parts that the picture cannot mark directly

- A part that is `position: absolute` or `fixed`, a table row or cell, or one whose element uses `::before` itself cannot carry a badge. Wrap it in an element of your own and put `data-mark` on the wrapper.
- A Dialog or a DatePicker needs several inert layers drawn in place (the trigger, the overlay, the dialog). Draw each one in a block of its own with a `data-mark`. The Select-sized `max-width` of `.anatomy-popover` does not fit them: give the wrapper a class of your own, or override it.
- The demo name must end in `Anatomy` (`SelectAnatomy`). The drift test fails otherwise.

### Checklist

1. `brm anatomy` above the tag tree, one line per piece, in the order of the tags. Each line starts with the tag name in backticks.
2. Every piece marked with `data-mark`, numbers 1 to N once each, N equal to the lines. `website/test/anatomy.test.ts` checks this, the demo files, and the order against the tag tree.
3. For an overlay part (Popover, Dialog, Modal, Menu, ...): one visible sentence under the picture, "The picture draws the Popover in place, open, so that it can carry a number. The real Popover opens in a layer at the end of the page." The test requires the words "draws the Popover in place" when the demo has an `anatomy-popover` block.
4. A text that the picture shows must match the text of the real part. A SelectValue shows the key before the code loads, so pass `render` with a template that names the item.
5. One `brm styled` example with the states above. Class names are long and readable, `<part>-styled-<piece>` (`select-styled-button`), and no class is shared with another demo. The test checks the second rule.
6. Colors in `light-dark()` (and system colors) so the demo follows the site toggle in both directions. Never `@media (prefers-color-scheme)` alone.
7. A focus ring that shows on the fill of a selected item: two bands, an accent one and an inner one in the page color.
8. A state section with a live demo, if the part has state. Say what the part does on a form reset: see the list below.
9. Use cases (`## Use cases`, after Styling) that compose parts, each with a live demo.
10. `node scripts/check-samples.ts`, the website tests and build, and an e2e flow for the page (copy the /ui/select flow with the new slug).

### Form reset, as state.md states it

- Reset: TextField, NumberField, Select, Slider, ColorField, ColorSlider, ColorArea, ColorWheel, DateField, TimeField, DateRangePicker. The reset is a write, so a `$bind` setter can refuse it.
- No reset handler in packages/ui/src: Checkbox, Switch, CheckboxGroup, RadioGroup, ComboBox, SearchField, TokenField. The node ui-form-reset adds them. DatePicker, ToggleButton and the rest were not checked.

## Deviations

- The anatomy block takes its list from the fence body, not from the tag tree, so it can drift. The checklist asks the author to compare them.
- No use case of a list loaded from the server: a server function needs the server of the site, which the demos do not run. Left for the family nodes if a page needs it.
- The popover in the picture is drawn in place, not the real Popover. A sentence under the picture says so.

## Gotchas

- `data-*` on a part passes to its element, so `data-mark` works on any part that spreads its rest props.
- The badge uses `::before`. A part whose element uses `::before` for its own look cannot carry a mark; use a wrapper.

## Stubs left

- None.
