---
'brumate': minor
---

Type the ARIA attributes. Each `aria-*` attribute of WAI-ARIA 1.2 has its value type in `brumate/elements`: a boolean (`true`, `false` or the words), a tristate, an enumeration, a number or an ID list. `role` takes `AriaRole`, the roles of WAI-ARIA 1.2 and `doc-*`. `aria-${string}` still takes any other name. New exports: `AriaAttributes` and `AriaRole`.

A caller that keeps `role` in a `string` variable has to narrow it to `AriaRole`. `String(flag)` for an ARIA boolean can become the boolean. A number for an attribute that takes text, such as `aria-label=(1)`, is now a type error; pass a string.
