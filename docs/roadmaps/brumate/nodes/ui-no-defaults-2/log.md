# Log: ui-no-defaults-2

- Files: packages/ui/src/{contexts,layer,locale}.ts; readers LocaleContext in 30 .brm (every part with `localeStore`); LayerContext in Popover, Tooltip, ModalOverlay; FormContext in TimeField, Select, DateField, TextField, DateRangePicker, ColorField, NumberField, ComboBox; FieldError, Checkbox, Radio, Input, TextArea.
- Baseline from ui-no-defaults-1 outcome: 51 TS2554, 63 of 75 ui test files fail.
- Done: edits, checks, outcome. Combobox tests fail on the virtualizer context (group 4).
