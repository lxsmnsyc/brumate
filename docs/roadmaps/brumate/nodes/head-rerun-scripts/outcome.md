# Outcome: head-rerun-scripts

## Built

- `updateHead` in `packages/brumate/src/runtime/navigate.ts` never keeps a `<script data-rerun>`. It returns the ones of the next head, and `navigate` appends a `runnable` copy of each to the head after the new body is in place and the URL has changed, before the focus and scroll step. A page without the script removes the old one.
- `packages/brumate/test/head-rerun.test.ts`: 5 tests (fresh copy after the body, once, plain scripts kept; every navigation; new and removed; other root layout; nonce).
- e2e step in `e2e/suites/website.mjs` (link, then back button; counter 1, 2, 3).
- Section "Scripts in the head" in `website/docs/navigation.md`, one entry in `docs/decisions.md`, `.changeset/head-rerun-scripts.md` (minor, brumate).

## Proof

- base: `pnpm --filter brumate exec vitest run test/head-rerun.test.ts` with `src` stashed: 5 failed.
- branch: the same command, and with `test/navigate.test.ts`: 31 passed.

## Deviations

- The e2e step injects the script with `page.route` because the website has no such script and the brief forbids changing the theme script.
- Size: the `navigate-*.js` chunk grew 92 B gzip (7221 to 7313), above the 50 B in the acceptance. The maintainer accepted +92 B after the fresh review found no smaller shape that keeps one copy in the head. The loader chunk (2172 B) and the core are unchanged, and the chunk loads on the first navigation only. Not shrunk further.
- The probe of what a new head script without the attribute does in Chrome was not run (see log).

## Stubs left

- None.

## Gotchas

- The open question (scripts from a page with a different root layout) is settled: a `data-rerun` script of the next page always runs, whatever the old head held.
- A rerun script with `src` is removed and added again; a module script does not run again.

## Proposed learnings

- None.

## Verification

- `vitest run test/head-rerun.test.ts test/navigate.test.ts`: 31 passed.
- Full brumate vitest (`--maxWorkers=2`): first run 3206 passed, 1 file failed; second run only `test/render.test.ts` failed with a 10 s `beforeAll` timeout (load from other workers), and alone once it timed out again. It does not touch navigate; not investigated further.
- `node e2e/run.mjs --only website`: 72 passed, 1 failed (`/ui/color-scheme: color-contrast` in the sidebar accessibility step, from the color-scheme node), 2 skipped after that failure. The new step passed.
- `pnpm --filter website check:samples`: 69 samples, 0 problems.
- `pnpm exec oxlint`: warnings only, none in changed lines. `pnpm format:check`: pass. `pnpm typecheck`: pass.

## Size

- Estimated S, actual S.
