# Log: size-baseline

- 2026-10-27: worktree at main `f45a5c74`, code identical to `654f05dd`. Branch `chore/size-baseline`.
- `pnpm install --frozen-lockfile` in the worktree. `pnpm bench` builds the packages itself.
- Ran `pnpm bench --scenario todos,dashboard` three times (266 to 293 s each), then `--scenario rows` once (about 24 min). Load averages at the starts: 8.76, 8.86, 6.50, and 8.14 for rows. Other agents were running at the same time.
- Sizes were the same in all runs. Timings varied by 2 to 12 times between runs. The doc records the median and each run, and says to compare only on the same machine.
- JS before `load` for todos is 13.9 kB gzip (5 files), against 2.1 kB in the 2026-10-22 README. The smaller-client acceptance compares against this new number.
- The rows report has no "JS before load" row. The doc records the build output size of the rows app instead.
- Raw outputs stayed in the scratchpad. `benchmarks/results/` is git-ignored, so nothing from it is committed.
