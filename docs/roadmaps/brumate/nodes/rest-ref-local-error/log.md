# Log: rest-ref-local-error

- The check sits in the Resolver of analyze.ts. Declarations of the props object (`const props = $props()`) and of the rest (`...rest`) carry `whole`. A bare identifier that resolves to one is an error, except the value of a markup spread site (element, dynamic tag, component) and the object of a member expression (`rest.x`, `rest['x']`).
- The check was not in the analyzer before: no test or message named the case.
- Scanned all 709 `.brm` files (packages, website, benchmarks, e2e) with the built compiler. One hit: packages/ui/src/NavigationTreeItem.brm. Test fixtures had none.
- The catalog entry makes references/errors.md out of date: regenerated with `UPDATE_SKILL=1 vitest run test/skill.test.ts`.
- Devtools, features and resume tests of packages/brumate time out under load with other workers. Each passes alone.
