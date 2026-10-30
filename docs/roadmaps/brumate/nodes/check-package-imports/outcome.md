# Outcome: check-package-imports

## Built

- `brumate check` resolves `.brm` modules and `'use server'` files of packages of components through `findPackages` and `resolvePackageImport`, as the vite plugin does (`packages/brumate/src/check-command.ts`). A missing module still reports BRM167.
- Tests in `packages/brumate/test/check-command.test.ts` ("package imports"). Changeset `.changeset/check-package-imports.md` (patch).

## Deviations

- `packages/brumate/src/vite.ts`, `packages.ts` and `server-files.ts`: the package resolution of vite moved into `resolveComponentPackage` (packages.ts) and `findPackageServerFile` (server-files.ts), which vite.ts and check-command.ts both call. Vite behavior is unchanged (vite and packages tests pass).
- The server-function follow-up for package imports is covered. tsconfig aliases and folder index files are not: they need the alias resolution of vite, which check does not have.

## Stubs left

- None.

## Gotchas

- Only packages that opt in with `"brumate"` in package.json are resolved, the same rule as vite.

## Proposed learnings

- None.

## Verification

- `vitest run test/check-command.test.ts`: pass. `npx brumate check ui/demos` in website (with the type check): no errors.

## Size

- Estimated S, actual S.
