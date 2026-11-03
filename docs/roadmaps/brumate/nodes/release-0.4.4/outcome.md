# Outcome: release-0.4.4

## Built

- Version Packages #432 shows brumate 0.4.4, language-core 0.2.4, and language-server, tsc and typescript-plugin 0.1.8, all patch bumps.
- The release carries two hotfixes: #430 (an effect or update that writes what it reads stops with BRM187 instead of hanging the tab) and #431 (a `#try` body that fails twice at once shows the first error, once).

## Checks on main (7d9b4564)

- `pnpm build`: pass.
- `pnpm test`: pass (ui 772 passed, 1 expected fail).
- `node e2e/run.mjs`: todos 9, tracker 14, nitro 2, kit 5, ui 55 pass. website: 61 passed, 1 failed, 10 skipped. The failure is "/ui: the overlays open, save, close and give focus back", step "Escape left the tooltip".
- The tooltip failure is a timing flake, not a regression:
  - On main, `--only website` failed 5 of 9 runs, with the failures clustered while other builds and tests loaded the machine; the last 3 runs, on a quiet machine, passed.
  - With timing added, the tooltip closed 70 to 372 ms after Escape when it closed; a failing run left it open past 20 s.
  - The release commit of 0.4.3 (0891368f) passed 2 of 2, and the merge of #430 alone (70c9f281) passed 4 of 4, but #431 changes only the `#catch` path of `fail()`, and the three logged runs on main raised no `brumate:error`, page error or console error, so that code never ran in this flow.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 35.8 kB / 14.9 kB gzip, the same as 0.4.3.
- `pnpm pack --dry-run` in packages/brumate: no test files.

## Follow-ups

- The tooltip step of the website overlays flow is flaky under load: it waits a fixed 1500 ms after Escape. A wait for the tooltip to go, with a timeout, would make it stable.
- Sync `main` into `next`, then `next` into feat/browser-async, pushed directly, after #432 merges.
