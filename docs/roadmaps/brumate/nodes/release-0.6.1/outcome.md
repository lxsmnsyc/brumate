# Outcome: release-0.6.1

## Built

- brumate 0.6.1 is on npm (2026-11-07). Version Packages #477 (4abf1cfb), Release run 42246510347.
- @brumate/ui 0.1.3 (the TextField and SearchField refused-edit fix). Other packages got patch bumps only for their `workspace:` dependency: @brumate/language-core 0.2.9, @brumate/language-server, @brumate/tsc and @brumate/typescript-plugin 0.1.13.
- Changesets: 12 brumate patch entries, 1 of them shared with @brumate/ui.
- `next` fast-forwarded to `main` after the release.

## Deviations

- The maintainer merged #477 before the checks on `main` ran; they ran on 4abf1cfb right after, while the Release run waited for the `npm` environment.

## Stubs left

- None.

## Gotchas

- The website e2e flow `/ui: the text and number fields edit, refuse, reset and send` failed: it still expected the typed text after a refused edit, which #484 changed. Test fix: #486 (fix/e2e-text-field-refused). No code change.
- The website e2e flows `/docs: a navigation with no click returns to / with the same panel` and `/docs: the theme survives client navigation` fail with an empty page error under load, one per run. The same flow fails on 0.6.0 (8d368ad3), so it is not from 0.6.1.
- `packages/ui/test/preview.test.ts` (hover delay) and the ui e2e Toast timeout flow failed once in the full runs and passed when rerun alone (3 of 3, and 56 of 56).

## Verification

- On `main` 4abf1cfb:
  - `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm --workspace-concurrency=2 -r typecheck`: pass.
  - `pnpm test`: brumate 2865, ui 777 + 1 expected fail (1 timing fail, passes alone), language-server 7, vscode 5, tsc 2, examples pass.
  - `node e2e/run.mjs`: todos 10, tracker 17, nitro 2, kit 5, browser-async 6, ui 56 on rerun; website see Gotchas.
  - `pnpm --filter website check:samples` and `pnpm --filter website build`: pass.
  - `pnpm pack --dry-run` in packages/brumate: no test files or fixtures.

## Size

- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 32.9 kB / 13.7 kB gzip (0.6.0: 32.4 kB / 13.6 kB).
