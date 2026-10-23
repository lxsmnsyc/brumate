---
'brumate': minor
---

Progressive forms with `createForm` from `brumate/forms`. A form works without scripts, and with them it validates and changes its lists in the browser.

- `createForm(fn, schema, { defaultValue })` gives the attributes of a form and its fields: names, IDs, the posted values, errors with their ARIA attributes, and buttons that add, remove and move the items of a list.
- `parseSubmission(schema, form)` from `brumate/server` reads such a form, applies the button that changed a list, validates, and builds the reply with `reply()`. `parseForm` reads indexes in brackets, so `items[0].name` makes a list.
- With scripts, the form validates in the browser with the schema, which loads with the first focus out or input. A field shows its errors once the user leaves it, and every field does after a submit.
- With scripts, the buttons of a list change it in the browser at once, and the items that stay keep their elements and what was typed in them. The buttons prevent the post even before their code loads.
- A package can export a `.brm.ts` module under a name without the extension, such as `@acme/ui/forms`.
- Code of a module function that the compiler copies into a component keeps the imports that it needs in the browser parts.
