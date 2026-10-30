# Log: check-package-imports

- Reproduced with three tests in `packages/brumate/test/check-command.test.ts` (module from a package, missing module, `'use server'` file from a package). Two failed on main.
- Fix: `check-command.ts` passes `resolveModule` (disk first, then `resolvePackageImport` for packages found by `findPackages`) and a package-aware `serverImport`, as vite.ts does.
- `npx brumate check demos` in website/ui: "No errors."
