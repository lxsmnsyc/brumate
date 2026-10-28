---
'@brumate/ui': patch
---

A part now shows the value its caller keeps when a `$bind(signal, fn)` setter refuses a write, an edit or a reset. This fixes `NumberField`, `ColorField`, `ColorSlider`, `ColorArea`, `ColorWheel`, `TimeField` and `DateRangePicker`, whose text, thumbs or segments stayed on the refused value. The range inputs of `Slider`, `ColorSlider`, `ColorArea` and `ColorWheel`, the inputs of a `Checkbox`, a `Switch`, a `CheckboxGroup` and a `RadioGroup` go back to the kept value as well.

Every part with a bound value now calls its change handler (`onChange`, `onSelectionChange`) with the value the caller keeps, and only when that value changed. A setter that refuses calls no handler, and a setter that rounds or uppercases gets the handler with the changed value.
