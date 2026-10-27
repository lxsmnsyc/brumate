# Outcome: docs-controls

## Built

- The 16 pages of Buttons and Forms in website/ui follow the props-table contract. Each has a `props` block for every part it covers.
- Doc comments for the props of 27 parts in packages/ui/src (170 comments, comments only): Button, ToggleButton, ToggleButtonGroup, Link, FileTrigger, DropZone, TextField, Input, TextArea, Label, Text, FieldError, SearchField, TokenField, TokenInput, Token, NumberField, Slider, SliderOutput, SliderTrack, SliderThumb, Checkbox, CheckboxGroup, RadioGroup, Radio, Switch, Form. No prop of these parts has an empty Description.
- Changeset .changeset/docs-controls.md (patch, @brumate/ui).

Sections per page (A anatomy, P props, D data attributes, K keyboard, C controlled and uncontrolled, S styling). x = written, - = left out on purpose.

| Page                | A   | P   | D   | K   | C   | S   |
| ------------------- | --- | --- | --- | --- | --- | --- |
| button              | -   | x   | x   | x   | x   | x   |
| toggle-button       | -   | x   | x   | x   | x   | x   |
| toggle-button-group | x   | x   | x   | x   | x   | x   |
| link                | -   | x   | x   | x   | -   | x   |
| file-trigger        | x   | x   | -   | x   | -   | x   |
| drop-zone           | x   | x   | x   | x   | -   | x   |
| text-field          | x   | x   | x   | x   | x   | x   |
| search-field        | x   | x   | x   | x   | x   | x   |
| token-field         | x   | x   | x   | x   | x   | x   |
| number-field        | x   | x   | x   | x   | x   | x   |
| slider              | x   | x   | x   | x   | x   | x   |
| checkbox            | -   | x   | x   | x   | x   | x   |
| checkbox-group      | x   | x   | x   | x   | x   | x   |
| radio-group         | x   | x   | x   | x   | x   | x   |
| switch              | -   | x   | x   | x   | x   | x   |
| form                | -   | x   | -   | x   | -   | x   |

Left out: Anatomy for a single part (contract). Data attributes for FileTrigger and Form, which set none. Controlled and uncontrolled for Link, FileTrigger, DropZone and Form, which have no state.

## Deviations

- The old prose bullets stay under the demo on every page, as on button.md. Extra sections (Validation, Format, Stepping and so on) come after Styling, as the contract allows.
- The Props section of SearchField, NumberField and CheckboxGroup lists only their own part and links to the pages of the parts inside. The contract asks for the parts that the page covers.
- Demos are unchanged.

## Stubs left

- None.

## Gotchas

- SliderOutput takes `children` but never renders them: the `<output>` shows `slider?.label`. The doc comment says so. Either the prop should go or the output should render it.
- ToggleButtonGroup stops only ArrowUp and ArrowDown (vertical) from scrolling. Home and End are not prevented, so they may also scroll the page while they move focus. Not checked in a browser.
- ToggleButton doc: a plain `isSelected` starts own state. The source comment says `isSelected` alone starts it as on, which reads unclear. The page says "starts the button's own state".
- NumberField PageUp and PageDown step by `step`, the same as the arrows. Only the Slider moves a tenth of the range.
- Breadcrumb.brm still has a comment that names a library ("React ..."), outside this node's pages. Remove it in the node that owns Breadcrumbs.
- Label, Text and FieldError are described on the TextField page. A later page for them must not repeat their comments.

## Proposed learnings

- Write a one-sentence doc comment on every prop at once with its type | the props table shows it, and a page with an empty cell is not complete | packages/ui/src | yes

## Verification

- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx tsdown` in packages/brumate, packages/tsc and packages/language-core, then `npx vite build` in website: passes (every `props` block resolves).
- Website tests (`node ../packages/ui/node_modules/vitest/vitest.mjs run`): 9 passed.
- `npx brumate-tsc --noEmit` in packages/ui and in website: exit 0.
- `npx vitest run --maxWorkers=2` in packages/ui: 58 files, 540 passed, 1 expected fail.
- `npx oxlint --quiet`: exit 0. Root `npx oxfmt --check`: passes.

## Size

- Estimated M, actual M.
