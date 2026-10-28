# Outcome: ui-docs-pages-fields

## Built

All five pages of the node: TextField, SearchField, TokenField, NumberField and Slider. Each has the four parts.

| Page        | Anatomy                                                                | Use cases                                                             | Styled                                                                   | Controlled and uncontrolled                                    |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| TextField   | TextFieldAnatomy (Input marked through a wrapper)                      | a list that follows the text, a note with a limit (`TextArea`)        | TextFieldStyled (rest, hover, ring, invalid, read only, disabled, error) | TextFieldStateDemo: four shapes, a Write button, Lock, a reset |
| SearchField | SearchFieldAnatomy (Input and Button marked through wrappers)          | results on Enter with recent searches, a field in a dialog            | SearchFieldStyled (a pill, `[data-empty]`, ring on the box)              | SearchFieldStateDemo                                           |
| TokenField  | TokenFieldAnatomy (the Token is in the `token` template)               | a message that a form sends, a search with filter tokens              | TokenFieldStyled (two kinds of token, selected, empty, read only)        | TokenFieldStateDemo                                            |
| NumberField | NumberFieldAnatomy (two Buttons and the Input marked through wrappers) | a quantity with a total, a required percent in a form                 | NumberFieldStyled (one box, ring on the box, ends of the range, error)   | NumberFieldStateDemo                                           |
| Slider      | SliderAnatomy (the track in a wrapper, since its rail uses `::before`) | a range that filters a list on release, vertical sliders with presets | SliderStyled (fill from the signal, two thumbs, `name` posted, disabled) | SliderStateDemo                                                |

- Every claim was read against packages/ui/src and clicked through in Chrome with real keys (below).
- The state demos have Lock and Reset buttons, so a refused write and a refused reset show on their own.
- Colors are in `light-dark()` and system colors. The styled demos draw their ring as two bands (or on the whole box with `:has([data-focus-visible])`) and set `outline: none` where the global outline would draw a third.
- Classes have a prefix of their own: `textfield-styled-`, `searchfield-styled-`, `tokenfield-styled-`, `numberfield-styled-`, `slider-styled-`. The use cases use the site classes, and the vertical sliders use `slidermixer-`.
- website/ui/state.md: the sentence about TextField and SearchField now also names TokenField (below).
- e2e/suites/website.mjs: one flow for the five pages in both schemes (CSS shows, callouts equal the listed pieces, axe finds nothing on the article, with no excluded node), and one flow that uses them (see below).

## What each state demo says about a refused write

Checked in Chrome, on main after #332:

- NumberField and Slider show the kept value, in the shown value, the input and the hidden input. A reset that a setter refuses leaves the kept value. NumberField also keeps the typed text out: typing 9 and pressing Enter with Lock on leaves the old number.
- TextField and SearchField keep the typed text in the input until a reset. The Escape key of SearchField does not clear that text either. After an accepted edit, or a reset, the input shows the kept text again.
- TokenField keeps the typed text in the box too, and it is worse than the two above: a reset does not remove it when the kept segments equal the first ones, because the value did not change and nothing writes the box. The next accepted edit writes it. The page and state.md say so.
- All three are gaps that `bind-read-your-writes` closes. The pages name that node.
- `onChange` reports the requested value in every part.

## Checked in Chrome

- TextField: the Lock demo (typed "Adaxyz" stays in the input, the signal keeps "Ada", Reset gives "Ada"), a filter that follows each key, a `TextArea` with `maxLength` that stops at 80 with the count at 0.
- SearchField: Enter searches and keeps recent searches, Escape clears and runs `onClear`, a dialog keeps open on the first Escape and closes on the second, Enter in the dialog closes it, Lock leaves the typed text after Escape, Reset puts the kept text back.
- TokenField: typing `@bob ` makes a token, a form sends "hello @ada and #tag" as text, Reset empties the box, a `role="searchbox"` field with `owner:ada ` filters the list, and the refused-edit behavior above.
- NumberField: ArrowUp steps and a locked field keeps the number, the hidden input too, a button press and a typed 9 with Enter are refused, a quantity stops at 8 with the plus button disabled and focus still in the input, 10% steps to 15%, an emptied required field is blocked by the browser with "Please fill out this field." and sends nothing.
- Slider: keys and drags with Lock leave the thumb, the output and the range input at the kept value, Reset restores, Write 80 moves the third slider, the range filter applies on release, PageUp moves by 80 on a range of 0 to 800, a vertical slider steps with the arrows, the presets write three signals.
- Contrast was measured in Chrome with a canvas read of the computed colors, in four combinations (OS light and dark, site toggle matched and against the OS), against the stage (`--surface`). Text is at 4.5:1 or more, and the borders, rings, glyphs, the rail and the thumbs are at 3:1 or more, in all four. The lowest values: input border 3.27, rail 3.11, help text 6.5, placeholder 7.5.
- axe on the whole article of each page, in light, dark, and both mixed combinations, finds nothing, with no exclude.

## The e2e flow

"/ui: the text and number fields edit, refuse, reset and send" visits the five pages and checks: a refused TextField edit keeps the typed text and the signal, Reset restores, a SearchField dialog survives the first Escape and closes on the second, a typed `@ada ` becomes a token and the form sends the text, a filter token filters, a NumberField step is refused when locked and stops at the maximum, a required percent sends nothing when empty, a Slider key is refused when locked, a range filters, and a preset writes the sliders. Each assertion reads the page after a real key or click. A mutation check is in the PR description.

## Deviations

- The brief did not ask for the edit of website/ui/state.md. One sentence names TokenField, since the page claims differ otherwise.
- The TokenField anatomy counts a callout twice in the DOM, since a TokenInput draws each token in a hidden copy that the box clones. The flow counts the callouts that are not inside a `[hidden]` element.
- No changeset: only the website changes.
- Screenshots: all five pages, anatomy and styled, light and dark, in the scratchpad of the session. Three pages were reviewed closely (TokenField, NumberField, Slider).

## Part bugs found, not fixed here

- (a) TokenField: a refused edit keeps the typed text in the box, and a reset does not remove it when the kept segments are the first ones (see above). `bind-read-your-writes` is the fix.
- (b) A SliderThumb carries a badge only with `style="position: absolute"` in the picture, since the picture's `[data-mark] { position: relative }` overrides the part's own rule. Said in a comment of the demo.

## Stubs left

- None.

## Notes for the next pages

- A part whose element draws with `::before` (a SliderTrack's rail, a TokenInput's placeholder when empty) cannot carry a badge: use a wrapper.
- A part inside a `#template` that a part clones (the Token) is in the DOM more than once. Count callouts outside `[hidden]`.
- On macOS, `Control+A` in Chrome moves the caret to the start of the line. Use `Meta+A` in a flow that selects all.
