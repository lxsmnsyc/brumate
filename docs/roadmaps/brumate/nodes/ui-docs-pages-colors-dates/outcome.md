# Outcome: ui-docs-pages-colors-dates

## Built

The seven pages of the color parts: ColorPicker, ColorSwatch, ColorSlider, ColorArea, ColorWheel, ColorField and ColorSwatchPicker. The node stays `active` for the dates pages.

| Page              | Anatomy                                          | Use cases                                                         | Styled                  | Controlled and uncontrolled                   |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| ColorPicker       | skipped, it renders no element                   | a color in a form with presets, a part with its own color         | ColorPickerStyled       | ColorPickerStateDemo, four shapes             |
| ColorSwatch       | skipped, one element                             | a palette table with names, an opacity preview                    | ColorSwatchStyled       | skipped, no state                             |
| ColorSlider       | ColorSliderAnatomy                               | red, green and blue on one signal, a slider in a form             | ColorSliderStyled       | ColorSliderStateDemo, four shapes and a reset |
| ColorArea         | ColorAreaAnatomy                                 | an area with a hue slider, an area in a form (`xName`, `yName`)   | ColorAreaStyled         | ColorAreaStateDemo, four shapes and a reset   |
| ColorWheel        | ColorWheelAnatomy (the ring marked by a wrapper) | colors from one hue, a wheel in a form                            | ColorWheelStyled        | ColorWheelStateDemo, four shapes and a reset  |
| ColorField        | ColorFieldAnatomy (Input marked by a wrapper)    | channels of one color on one signal, a field in a form            | ColorFieldStyled        | ColorFieldStateDemo, four shapes and a reset  |
| ColorSwatchPicker | ColorSwatchPickerAnatomy                         | a stack for a label color, presets and a custom field in a picker | ColorSwatchPickerStyled | ColorSwatchPickerStateDemo, four shapes       |

- Every claim was read against packages/ui/src and checked in Chrome. No page claims a reset for ColorPicker or ColorSwatchPicker, which are not form fields. A ColorField inside a ColorPicker writes the picker on a reset of its form, which the ColorPicker form use case shows with a Reset button.
- ui-refused-write-sync (#332) is not on main. The pages describe main: a refused `$bind` request leaves the part drawing the refused value (ColorSlider, ColorArea, ColorWheel, ColorField, and a ColorPicker through its field). Measured in Chrome with the state demos. Each page says that #332 changes this. Whichever PR lands second removes the sentence (a line that starts "With a request that refuses" in each Controlled and uncontrolled section).
- Colors use `light-dark()` and system colors. Every styled example draws its focus as bands (page color, then accent) and sets `outline: none`. Axe `color-contrast` finds nothing at rest on the seven pages in light and dark, with the site theme toggled against the OS setting. Axe sees only the rest state, so the hover and press states were measured in Chrome with a real pointer: the Save button of ColorFieldStyled is 4.85:1 at rest, 6.26:1 on hover and 8.16:1 pressed in light, and 8.09, 9.25 and 10.54 in dark. The accent ring colors (#2a76b2, #6fb2e6) are above 3:1 on the stage. The other states (item rings of the swatch pickers, thumbs, input borders) were not measured one by one.
- The disabled ColorSlider and ColorField dim the track and the input, not the text, since dimmed text failed 4.5:1 in axe.
- e2e/suites/website.mjs has one flow for the seven pages in both schemes (styled CSS shows, callouts equal the listed pieces, axe finds nothing). It excludes `.props-table`, which fails `scrollable-region-focusable` on main (node ui-scroll-focus). Delete the exclude when that node lands.
- No change to website/src/routes/ui/_layout.brm. The state and use-case demos use its existing classes.

## Deviations

- The brief lists twelve pages. The five dates pages are left (below), so this PR is one coherent group.
- ColorPicker has no anatomy picture, and ColorSwatch has neither anatomy nor a state section.

## Checked in Chrome

- Keys: ArrowRight 40 times fast on the wheel, 20 on the slider and the area, ArrowUp on a channel field. Values and text stay equal.
- Forms: each form demo submits without a reload, sends the names it has (`hue`, `s` and `b`, `brand`, `background` and `opacity`), and Reset gives back the first values.
- A key with Ctrl, Alt or Meta moves a thumb one step, so the pages say that only a pointer press ignores the modifiers.
- The picker: a preset click writes the field, a typed color unselects every preset, and a part with its own `value` moves alone.
- Lock then edit: the last control of each state demo shows the refused value and keeps the signal (the #332 case).

## Stubs left

- The five pages of dates: calendar, range-calendar, date-field, time-field, date-picker. They need I18nProvider in at least one use case, and the DateRangePicker, TimeField and DateField reset text of state.md.
