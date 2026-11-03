# Outcome: release-0.5.1

## Built

- Version Packages #441 shows brumate 0.5.1 (patch), @brumate/language-core 0.2.6, and @brumate/language-server, @brumate/tsc and @brumate/typescript-plugin 0.1.10, the last four only for their `workspace:` dependency on brumate.
- The release carries one hotfix: #438 (template-import-render). The browser render module of a component that uses another component only in a `#template` inside a block now imports it.

## Checks on main (a9a82b54)

- `pnpm build`: pass.
- `pnpm test`: pass on a quiet machine (brumate 2163, ui 772 passed and 1 expected fail, the examples and language packages). A first run at a load average of about 40 failed 3 timing tests in `resume.test.ts`.
- `node e2e/run.mjs`: website 72, todos 9, tracker 14, nitro 2, kit 5, ui 55, browser-async 6, no failures.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 32.4 kB / 13.6 kB gzip, the same as 0.5.0.
- `pnpm pack --dry-run` in packages/brumate: no test files.

## Follow-ups

- The maintainer keeps #441 open (2026-11-03) so more hotfixes found during 0.6.0 work can join 0.5.1. Each new hotfix gets its own node in milestone 0.5.1 that this node waits for; rerun the checks on `main` before the hand-off.

- After #441 merges and 0.5.1 is on npm: merge `main` into `next` directly, and remove the "template-import" entry of the differential test in that merge.

## Released

- 0.5.1 on npm (2026-11-03, #441), with #438 and #450. `main` merged into `next` (8445f9c3), and the template-import divergence removed from the differential test (d7de5f7e). Checks on the merge: lint, format, typecheck, and brumate's 2797 tests pass.
