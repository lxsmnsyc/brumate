---
'@brumate/ui': patch
---

A part now shows the value its caller keeps when a `$bind(signal, fn)` setter refuses a write, an edit or a reset. This fixes `NumberField`, `ColorField`, `ColorPicker`, `ColorSlider`, `ColorArea`, `ColorWheel`, `TimeField` and `DateRangePicker`, whose text, thumbs, segments or fields stayed on the refused value. The range inputs of `Slider`, `ColorSlider`, `ColorArea` and `ColorWheel`, the inputs of a `Checkbox`, a `Switch`, a `CheckboxGroup` and a `RadioGroup` go back to the kept value as well. A part passes `onChange` the value the user asked for, as before; the setter decides what is kept.
