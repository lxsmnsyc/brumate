# Log: dock-split

- 2026-11-09: cut `feat/dock-split` from `origin/feat/dev-dock-redesign`. The branch base predates the roadmap commits that hold the brief and the contract, so both files come from main in the worktree.
- Moved the code by line range with a script, then fixed the closure variables by hand: 15 variables of `togglePanel` became fields of `Shell`.
- Checked equivalence with a throwaway test (removed, not committed): the old file and the new entry opened on all 13 tabs, with edits, filters, pause, error selection, graph node click, block fire, Pick, close and reopen. The `.panel` HTML was equal for every step, in both run orders (after one warm-up run; a cold first run differed in timing only).
- `devtools.test.ts` 14 passed, full brumate suite 3025 passed.
