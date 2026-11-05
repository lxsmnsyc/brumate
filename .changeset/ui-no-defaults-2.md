---
'@brumate/ui': minor
---

`LocaleContext`, `LayerContext`, `InputContext`, `TextAreaContext`, `FieldInputContext`, `FieldErrorContext`, `FormContext`, `CheckboxGroupContext` and `RadioGroupContext` have no default. Reading one with no provider throws. The parts that read them still render alone, and a part outside an I18nProvider still uses `en-US`. Code that reads these contexts itself guards the read with `$hasContext(Context)`.
