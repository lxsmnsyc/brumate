# Outcome: release-0.4

## Built

- PR #98 (Version Packages) merged on 2026-10-31. The Release workflow published brumate 0.4.0, @brumate/ui 0.1.0, @brumate/language-core 0.1.0, and @brumate/language-server, @brumate/tsc and @brumate/typescript-plugin 0.1.4.
- The changelog comes from the 51 changesets of changeset-review (#390).

## Checks on main (5cbb9bd1)

- CI: lint and typecheck, tests on Node 22 and 24, and the website build pass.
- `pnpm build && node e2e/run.mjs` passes: website 72, todos 9, tracker 14, nitro 2, kit 5, ui 55.
- Pack check of the published tarballs: brumate 0.4.0 has 126 files and @brumate/ui 0.1.0 has 196. Neither has test fixtures, and each ships its skill under `skills/`.
- `pnpm bench`, todos: JS before `load` 36.6 kB / 15.2 kB gzip (0.3.0: 26.4 kB / 11.2 kB, with 1.2 kB more fetched while idle). It matches perf-pass-0.4. The first click right after load takes 0 round trips (0.3.0: 1). SSR HTML for 3 todos is 711 B gzip.

## Notes

- The checks ran after the publish, since the version pull request merged before this node was closed.
- The 0.5.0 acceptance compares todos' gzip JS before `load` against this 15.2 kB.
