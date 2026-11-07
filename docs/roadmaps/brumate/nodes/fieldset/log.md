# Log: fieldset

- Checked first: test/fieldset.test.ts did not exist, so the work was new.
- Added DisabledContext (a store of a boolean) in contexts.ts; Fieldset and Form provide it, joined with the context above them.
- A part reads it with `$getContext(DisabledContext, undefined)` and `$store`, and joins it with its own `isDisabled`.
- Fieldset also sets `disabled` on the native `<fieldset>`, so plain inputs inside post nothing too.
- Docs page, three demos, a card (ui-groups.ts), an example section and an e2e module.
