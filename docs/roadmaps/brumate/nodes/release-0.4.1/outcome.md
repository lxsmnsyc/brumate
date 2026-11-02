# Outcome: release-0.4.1

## Built

- Checked main at 1c794af2 for the 0.4.1 release and handed the Version Packages pull request (#396) to the maintainer. #396 lists brumate 0.4.1 with 8 patch changesets (#401, #402, #403, #404, #406, #408, #395, #397), and patch bumps of @brumate/language-core 0.2.1 and @brumate/language-server 0.1.5. No minor or major changeset is on main.

## Verification

- `pnpm build`: pass.
- `pnpm test`: brumate 1309 passed and every example passed. packages/ui: 2 failed, 770 passed. `bind-kept-writes` "puts the input of a Switch back when the setter throws" and `token-field-sync` "shows the kept value after a refused edit" fail on every run when run alone, and "shows the first value after a reset that gives back the kept one" fails in some runs. All three fail the same way at the brumate@0.4.0 tag, so 0.4.1 did not cause them. CI passes them on Node 22 and 24; this machine runs Node 26.12.1.
- `node e2e/run.mjs`: todos, tracker, nitro, kit and ui (55) passed. website failed once at "/docs: the theme survives client navigation" (page error with no message). Two reruns of the website suite alone (`--only website --no-build`) passed 72 of 72.
- `pnpm bench --only brumate --scenario todos --metrics browser,dist`: JS before `load` 5 files, 35.5 kB / 14.8 kB gzip (0.4.0: 36.5 kB / 15.2 kB). Client JS in dist 7 files, 80.1 kB / 28.4 kB gzip. Load average was about 11, which affects the timings but not the sizes.
- `pnpm pack --dry-run` for brumate, @brumate/language-core and @brumate/language-server: no test fixtures. brumate ships dist/runtime/testing.js, which is the public `brumate/testing` entry.

## Deviations

- None.

## Gotchas

- The packages/ui failures above happen locally on Node 26 even at 0.4.0. Check the Node version before calling them a regression.
- After #396 merges, merge main into next. It conflicts in packages/brumate/src/runtime/client/updates.ts (`trigger`, `queueWrite`, `pass`) between #402 and #407. Then restore the two tests that #407 deleted (see the brief).

## Size

- Estimated S, actual S.

## Closed

- #396 merged on 2026-11-01 and brumate 0.4.1 is on npm. #410 synced `next` with `main` and restored the two rejected load tests (6718cb33).
