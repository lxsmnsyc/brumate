# Outcome: release-0.4.3

## Built

- brumate 0.4.3 is on npm, with language-core 0.2.3 and language-server, tsc and typescript-plugin 0.1.7, all patch bumps (Version Packages #426).
- The release carries two hotfixes: #424 (an async memo whose expression gives a string or an array, with `await` inside, fills in a browser render) and #427 (files and blobs sent to server functions keep their type, name and `lastModified`).

## Checks on main (2e0465db)

- `pnpm build`: pass.
- `pnpm test`: 11 ui tests failed in as-collections, calendar, preview, token-field-sync and tooltip at load average 8-9, most with `TypeError: Cannot read properties of undefined (reading 'id')` in `effect` from handler passes after a test's scope was gone. Four files pass alone; token-field-sync passed 3 of 3 alone. Treated as load flakes; token-field-sync also failed under load in the 0.4.2 run.
- `node e2e/run.mjs`: website 72, todos 9, tracker 14, nitro 2, kit 5, ui 55, all pass.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 35.7 kB / 14.9 kB gzip, the same as 0.4.2.
- `pnpm pack --dry-run` in packages/brumate: no test files.

## Follow-ups

- Sync `main` into `next`, then `next` into feat/browser-async, pushed directly.
