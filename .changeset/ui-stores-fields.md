---
'@brumate/ui': minor
---

Breaking for code that provides or reads these contexts itself. `LabelContext`, `GroupContext`, `FieldErrorContext`, `FormContext` hold a `StoreLike<...>` of the value they held before, and a plain value now throws "gives no store". `InputContext` and `TextAreaContext` hold `InputField`, the `props` store plus the handlers, and `InputContextProps` lost its handlers to `InputHandlers`. To migrate, provide with `$setContext(LabelContext, $toStore(memo))` and read with `$store(LabelContext)`.
