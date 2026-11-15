# Outcome: release-0.8

## Built

- The five open should fixes moved back to 0.8.1 as must nodes on `main` (515c1327).
- `main` (0.7.1, 0.7.2) merged into `release/0.8` (10d853fd), with eight conflicts resolved by the merge notes of release-0.7.1. The Trusted Types fix of 0.7.2 is applied by hand to the split dock modules in `runtime/devtools-panel/`.
- Changesets: 12 on `release/0.8`. None needed merging. brumate: 7 minor, 2 patch. @brumate/ui: 3 minor. @brumate/language-core: 1 minor.
- Promotion pull request #519 (`release/0.8` -> `main`).

## Deviations

- 1cca4b10: render-memo-reads had dropped the 0.7.1 fix inline-memo-errors. `heldMemos` only took memos that could give a promise, so `$memo(big + 1)` with a BigInt threw at its declaration. Such a memo is now a candidate too. The memos snapshot wraps more memos in `renderMemo` again, as main does. Todos size did not change.
- 78e04f73: the e2e server requires Trusted Types since 0.7.2, which refuses `page.addScriptTag`. The ui suite's axe steps now evaluate the axe-core source.

## Gotchas

- Under a load average of 12 to 36, the full `pnpm test` times out in tsc.test (5 s), several ui tests and a few resume tests. All pass alone or with `--testTimeout=60000`.
- e2e is not in CI, so main's e2e change in #517 broke the ui suite unseen.

## Verification

On 78e04f73: build, lint, format:check and typecheck pass. pnpm test passes, except for the load failures above. e2e: website 75, todos 10, tracker 17, nitro 2, kit 5, ui 61, browser-async 6. check:samples has 70 samples and 0 problems, and the website builds. npm pack: brumate has 148 files and ui has 205, with no fixtures.

## Size

`pnpm bench --only brumate --scenario todos`: JS before `load` is 5 files, 33.2 kB / 13.8 kB gzip. 0.7.0 was 33.0 kB / 13.8 kB. Client JS in dist is 84.9 kB / 29.9 kB.

## Release

Waiting for the maintainer to merge #519, then the Version Packages pull request. After that: set released, cut `release/0.9` from `main`, close `release/0.8`.
