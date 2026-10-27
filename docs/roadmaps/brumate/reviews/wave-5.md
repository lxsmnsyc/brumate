# Checkpoint 2026-10-27, wave 5

## Merged since the last checkpoint

- fields-typed-early (#286): `readFields()` at init reads fields typed before the code loads. A select counts as typed against what the browser shows (last `selected`, else the first enabled option, none for a list box). Todos +281 B gzip, 19 B under budget. The clone trim failed in happy-dom.
- memo-errors-at-read (#287): a memo that throws holds the error, and each read throws to its `#try`. An update error no longer stops the pass. `tryCatchesClient` ships `#catch` for any `#try` that reads a memo (+139 B on such a page, accepted). Todos +49 B.
- component-tag-spread (#288): a live spread or computed attribute on a dynamic tag reaches the component, through a new live prop `~` (every prop but `children`). A computed attribute with no browser code next to a changing spread is a compile error with its own catalog entry. Todos -14 B.
- size-baseline (#289): docs/performance.md, main at f45a5c74. Todos JS before `load` is 13.9 kB gzip, not the 2.1 kB of the README of 2026-10-22; the eager loading of 2026-10-25 is the likely cause (unchecked). smaller-client's acceptance uses 13.9 kB.

## Added nodes

- memo-errors-server (must, core-correct): a plain memo declared outside its `#try` still fails at its declaration on the server. Holds a ready-made test for the awaited case.
- dev-setup-in-plugin (should, features): the plugin sets up hot updates and the devtools for a client entry that calls `start()` itself.

## Decisions

- An awaited memo, `const foo = await $memo(bar())`, throws at its declaration on the server, since `await` reads it there (the maintainer, 2026-10-27). Not in decisions.md yet; memo-errors-server adds the line.
- `~` could become `*` once batching removes the load race with a part's children.

## Next

- batching, memo-errors-server, rest-ref-spread, style-vars-target (must), then size-trim.

## Notes

- The worktree guard refuses `git` in isolated agents because the RTK hook rewrites it to `rtk git`. It hit reviewers four times and one worker. Two agents got around it with `/usr/bin/git` before they were told not to. Reviews ran from a non-isolated agent with the pr-review worktree script instead (the maintainer's choice). Exempting `git` from the RTK rewrite in `.claude/worktrees/` would fix it.
- Every PR needed two review rounds. Real bugs: an untouched select read as typed (#286), a false DEV warning and an untracked server gap (#287), a computed attribute dropped from updates (#288).
- Suites flake under the load of four agents; failing files pass alone. Three at a time stays the limit.
- size-baseline's worker left a wait loop running after it finished; stopped by hand.
