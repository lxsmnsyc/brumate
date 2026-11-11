# Outcome: dev-setup-in-plugin

## Built

- `packages/brumate/src/vite.ts`: on the dev server, `brumate/loader` imported by a client entry resolves to the virtual module `virtual:brumate/dev-start`. It exports `start`, which wraps `load` with `hotLoad(import.meta.hot, load)` and installs the devtools with the endpoint, rpc, versions and `import.meta.hot` of the start module. `devtools: false` leaves the devtools out. `startWithoutNavigation` is re-exported as it is.
- `hotLoad` returns an already wrapped load unchanged, and `installDevtools` returns early when the devtools are installed, so a manual call after the plugin's is harmless.
- `website/src/client.ts` drops `hotLoad` and `installDevtools`.
- Docs: reference-plugin, reference-server, getting-started, client-modules no longer ask for the calls, and say a manual call is harmless and that an alias of `brumate/loader` skips the setup.
- Tests: `packages/brumate/test/dev-setup.test.ts` (dev server, `devtools: false`, build) and `dev-setup-twice.test.ts` (a second `hotLoad` and `installDevtools` do nothing).
- Changeset: `.changeset/dev-setup-in-plugin.md` (minor).

## Deviations

- None.

## Gotchas

- An alias of `brumate/loader` to a path (as `packages/brumate/test/vite.test.ts` has) makes the id a file path before the plugin sees it, so the hook does not apply there.

## Verification

- Full `packages/brumate` vitest: 96 files, 3172 tests passed (before the review fix). After it: dev-setup tests and `test/devtools*` pass.
- `pnpm lint` (no errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm bench --only brumate --scenario todos`: total client JS 33.0 kB / 13.8 kB gzip, as on base.
- Website dev server: client entry imports the dev module with hot and devtools.

## Size

- Estimated M, actual S.
