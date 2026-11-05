# Outcome: release-0.6

## Built

- brumate 0.6.0 is on npm (2026-11-05). Promotion #458 (`next` -> `main`, merge commit 611fcf6e), Version Packages #462.
- Other packages got patch bumps only for their `workspace:` dependency on brumate: @brumate/language-core 0.2.8, @brumate/language-server, @brumate/tsc and @brumate/typescript-plugin 0.1.12, @brumate/ui 0.1.2.
- brumate 0.5.2 (#461, the layout `$route()` fix 3023ba9) shipped from `main` before the promotion merged.
- No should nodes of 0.6.0 were left open; the ones moved out went to 0.7.0 on 2026-11-03 (GOAL.md, Milestones).
- Changesets: 8, one per feature, none merged or dropped. brumate: 6 minor, 1 patch; brumate-vscode: 1 patch.
- `next` fast-forwarded to `main` after the release.

## Deviations

- The changesets were not merged into fewer entries: each one already covered one feature.

## Stubs left

- None.

## Gotchas

- A first `pnpm test` run under load failed differential and ui pointer tests from timing; the same suites passed on a rerun.

## Verification

- On `next` d7de5f7e:
  - `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm --workspace-concurrency=2 -r typecheck`: pass.
  - `pnpm test`: pass (brumate 2797, ui 772 + 1 expected fail).
  - `node e2e/run.mjs`: website 72, todos 10, tracker 14, nitro 2, kit 5, ui 55, browser-async 6, no failures.
  - `pnpm --filter website check:samples` (66 samples) and `pnpm --filter website build`: pass.
  - `pnpm pack --dry-run` in packages/brumate: no test files or fixtures.

## Size

- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 32.4 kB / 13.6 kB gzip, the same as 0.5.0.
