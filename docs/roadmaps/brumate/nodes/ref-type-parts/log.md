# Log: ref-type-parts

- Added the type case at the end of packages/ui/test/props-types.ts first. On main-state parts the ui typecheck failed for the 13 collection parts (`HTMLElement | undefined` not assignable to `HTMLElement`). Link, Button and Heading already accepted it, since `ref` came from the target of `as`.
- Declared `ref?: Bindable<HTMLElement | undefined>` in the own props of the 16 parts. The 13 collection parts read it with `$props<<Name>OwnProps>()`. Link, Button and Heading only declare it: they leave it in `rest`, which they already spread onto the root.
- The typecheck is clean, and a deliberate error in props-types.ts fails it.
- The case is in a `.ts` file, so the page-state check of the core (bound-element-signal) does not apply.
