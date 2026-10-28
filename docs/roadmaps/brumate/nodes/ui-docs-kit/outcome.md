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

### Checklist

1. `brm anatomy` above the tag tree, one line per piece, same order as the tags.
2. Every piece marked with `data-mark`, and the count of marks equals the lines.
3. One `brm styled` example with the states above, and its own class prefix.
4. A state section with a live demo, if the part has state.
5. Use cases (`## Use cases`, after Styling) that compose parts, each with a live demo.
6. `node scripts/check-samples.ts`, the build, and the e2e flow for the page (copy the /ui/select flow with the new slug).

## Deviations

- The anatomy block takes its list from the fence body, not from the tag tree, so it can drift. The checklist asks the author to compare them.
- No use case of a list loaded from the server: a server function needs the server of the site, which the demos do not run. Left for the family nodes if a page needs it.
- The popover in the picture is drawn in place, not the real Popover.

## Gotchas

- `data-*` on a part passes to its element, so `data-mark` works on any part that spreads its rest props.
- The badge uses `::before`. A part whose element uses `::before` for its own look cannot carry a mark; use a wrapper.

## Stubs left

- None.
