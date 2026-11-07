# Outcome: release-0.7

## Built

- Promotion branch `release/0.7.0` from `next` (a77b4934), with one changeset commit (89a2fefc).
- The open should and could nodes of 0.7.0 moved to 0.8.0 (680641fe): dev-dock-redesign, clone-remaining-bodies, no-client-html, render-memo-reads, cold-paths-spike, coverage-script, skill-tasks, part-guides and skill-blocks-typecheck.
- Changesets: 21 on `next`, 19 after the pass. brumate: 12 minor. @brumate/ui: 7 minor.

## Deviations

- store-any-source is merged into store-contract. The store-contract entry listed the sources of the first step and a compiler warning that static-contexts-final made the error BRM196; one entry now gives what 0.7.0 accepts.
- store-repair-compare (patch) is dropped: it fixed `$toStore`, which no release had shipped.

## Gotchas

- `resume.test.ts > refs forwarded through components > a ref left in the rest props reaches the element that spreads them` failed once in the full run (`expected '' to be 'BUTTON'`) and passed 3 of 3 alone and in its file. The test waits a fixed 300 ms after the click, so a slow first module load misses it. It dates from 2026-10-27. Fix: wait with `waitFor`.

## Verification

On `release/0.7.0` (89a2fefc), load average 4 to 22 from other sessions:

- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm test`: brumate 3025 of 3026 (the test above), ui 799 + 1 expected fail, tsc 3, language-server 7, vscode 5.
- `node e2e/run.mjs`: website 72, todos 10, tracker 17, nitro 2, kit 5, ui 57, browser-async 6, no failures.
- `pnpm --filter website check:samples` (67 samples, 0 problems) and `pnpm --filter website build`: pass.
- `npm pack --dry-run` in packages/brumate (135 files) and packages/ui (198 files): no test files or fixtures.

## Size

- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 33.0 kB / 13.8 kB gzip; client JS in dist 78.6 kB / 27.7 kB.
- 0.6.0 was 32.4 kB / 13.6 kB. Before context-stores (6f49651f, with the 0.6.1 fixes) it is 32.9 kB / 13.7 kB, so the 0.6.1 fixes (#485 render-memos among them, see render-memo-reads) grew it by 0.1 kB and already shipped. context-stores (#471, d4240387) adds 0.1 kB, for `$store` and `$toStore`. memo-guard and the later nodes add nothing.
