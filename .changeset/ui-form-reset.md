---
'@brumate/ui': patch
---

A reset of a form now gives back the first value of `Checkbox`, `Switch`, `CheckboxGroup`, `RadioGroup`, `ComboBox`, `SearchField` and `TokenField`. The part, its `data-*` attributes and its input follow, where only the native input did. The reset writes through the setter of `$bind(signal, fn)`, so a setter that refuses keeps the value. `TokenField` binds its `ref` to its element.
