# Log: shared-part-imports

- Repro with a module-script import: `importsFor` in `packages/brumate/src/codegen/client.ts` skipped every import of `<script module>`, because the shared part copies them. It copies them only when `usesModuleScript()` is true, which needs a read of a `module` declaration. `toggle` reads only the import `sameKeys`, so nothing copied it. Handler parts import from the instance script, so they worked. A first repro with the import in the instance script passed on main.
- The all-component test found a second gap: a template passed as a prop (`cell=day`) renders in the update part, and `importsFor` did not read the components in it (`CalendarCell`, `Token`, `Row` and others in test fixtures). Fixed by adding the templates of the children sites to the rendered scopes.
- Components of packages/ui/src have no other gaps. Only ToggleButtonGroup and CheckboxGroup had the shared-part gap.
- Local ui tests passed on main before the fix (the handler of a toggle is not run by them); the CI failure needs a run that loads the shared part.
