---
'brumate': minor
---

Progressive forms, step 1:

- `createForm(fn, schema, { defaultValue })` from `brumate/forms` gives the attributes of a form and its fields: names, IDs, the posted values, errors with their ARIA attributes, and buttons that add, remove and move the items of a list. It works without scripts.
- `parseSubmission(schema, form)` from `brumate/server` reads such a form, applies the button that changed a list, validates, and builds the reply with `reply()`.
- `parseForm` reads indexes in brackets, so `items[0].name` makes a list.
- A package can export a `.brm.ts` module under a name without the extension, such as `@acme/ui/forms`.
