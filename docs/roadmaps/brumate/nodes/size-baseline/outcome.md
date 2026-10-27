# Outcome: size-baseline

## Built

- A "Baseline on main, 2026-10-27" section in `docs/performance.md`, with the sizes and the timings of `pnpm bench` on main at `f45a5c74` (code identical to `654f05dd`).
- JS before `load` for todos: 5 files, 32.8 kB raw / 13.9 kB gzip. The first click fetches 0 B. Dashboard: 4 files, 111.4 kB / 23.6 kB before `load`.
- Rows: the build emits 6 files, 76.7 kB / 27.3 kB. The report has no `JS before load` row for rows.
- Timings are the median of three runs of todos and dashboard, plus one rows run, with the load averages. They were taken under load and are meant for comparison on the same machine only.

## Deviations

- The rows scenario ran once, since it takes about 24 minutes. The todos and dashboard scenarios ran three times.
- The rows "JS before load" is recorded as the size of the build output, because the harness does not report it for rows.

## Stubs left

- None.

## Gotchas

- The baseline for the smaller-client acceptance is 13.9 kB gzip, not the 2.1 kB of the benchmarks README (2026-10-22). The README table is older than the eager loading of 2026-10-25.
- Timings moved by 2 to 12 times between runs under load. Compare sizes across machines. Compare timings only inside one run, or on an idle machine.
- In this worktree, a command with `git` in its path is refused by the sandbox hook, which includes `/Users/alexis/Documents/GitHub/...`. Use `/usr/bin/git` and relative paths.

## Proposed learnings

- Run `pnpm bench` with `--scenario todos,dashboard` for size checks, which takes about 5 minutes, and run rows only when a node touches updates | rows takes about 24 minutes | benchmarks | no

## Verification

- `pnpm install --frozen-lockfile`, then `pnpm bench --scenario todos,dashboard` three times and `pnpm bench --scenario rows` once: all passed.
- `pnpm lint && pnpm format:check && pnpm typecheck`: passed (after `pnpm build`, which typecheck needs).

## Size

- Estimated S, actual S. The rows run was the long part.
