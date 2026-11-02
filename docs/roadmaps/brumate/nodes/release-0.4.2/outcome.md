# Outcome: release-0.4.2

## Built

- brumate 0.4.2 is on npm, with language-core 0.2.2 and language-server, tsc and typescript-plugin 0.1.6, all patch bumps (Version Packages #416, merged as 1435d26d).
- The release carries six hotfixes for browser renders: #415 (unread async memo), #417 (memo read only by `await`), #418 (`#try` around a child), #419 (constant async memo in text and attributes), #420 and #422 (`#try` around a `#template`), #421 (constant async memo in block headers, props and functions).
- Before the release, two changesets were corrected (9d7221b0): the #419 and #420 entries named limits that #421 and #422 removed.

## Checks on main (9d7221b0)

- `pnpm build`: pass.
- `pnpm test`: 6 ui tests failed in `token-field-sync` and `bind-kept-writes`, with `EnvironmentTeardownError` at load average 10-14. Both files pass alone, 7 of 7, twice. Treated as load flakes.
- `node e2e/run.mjs`: 1 failure, "/docs: the theme survives client navigation", with an empty page error. The website suite passed alone twice, 72 of 72. Treated as a load flake. todos, tracker, nitro, kit and ui passed.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 35.7 kB / 14.9 kB gzip (0.4.1: 14.8 kB).
- `pnpm pack --dry-run` in packages/brumate: no test files.

## Deviations

- The brief listed one hotfix; five more were found and fixed while it ran (await-read-memo-rejection, try-around-child, markup-read-async-memo, try-template, async-memo-block-headers, try-template-call-site).

## Follow-ups

- Sync `next` with `main`: branch chore/sync-next-0.4.2, merged without conflicts; checks in its PR.
- settled-memo-merge (browser-async) runs after the sync reaches feat/browser-async.
