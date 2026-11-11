# Log: skill-0-8-apis

- Block styles and the file's style as the outermost block were already in SKILL.md and syntax.md. Added the rest.
- state.md: "Derived stores" (cart.ts with `derived`, a reader with `$store`, one-way, not page state).
- syntax.md: head script with `raw()`, `getEvent().nonce` and `data-rerun` in `#head`; "Parts of @brumate/ui" with `ColorScheme` and `colorScheme()`.
- SKILL.md: three rules and the route lines.
- `test/skill.test.ts` could not resolve `@brumate/ui/color-scheme.brm.ts` (BRM167). `compileBlock` now reads a `@brumate/ui/*.brm.ts` module from packages/ui/src.
- The skill ships (`files` has `skills`), so `.changeset/skill-0-8-apis.md` is a patch for brumate.
- The worktree needed `pnpm build` of brumate, @brumate/language-core and @brumate/ui before the reference run. The ui build prints a pnpm exec error after its output; the run passed anyway.
