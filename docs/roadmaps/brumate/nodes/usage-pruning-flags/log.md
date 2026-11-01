# Log: usage-pruning-flags

- Applied prototype-flags.patch to next (clean). Kept the two review fixes: `fields` matches `$$b.binding(`, `routes` matches the context names. The patch has no BRUMATE_SPIKE_ON switch.
- Baseline bench (before the patch): todos 14.5 kB gzip JS before load, dashboard 24.2 kB (bench rounds to 0.1 kB).
- Tests added: facts per flag in feature-flags.test.ts; fixture check (render every fixture as a stream, tie `=$bind#`/`=$set:`, `b-catch`, `b-fail` to fields/tries/lateMarkup of the fixture and its imports); runtime tests with each flag off in the new feature-flags-off.test.ts; core builds with flags on and off in features.test.ts, including an @brumate/ui Input with `$bind`.
- Mutation checks: removing `$$b.binding(` from the fields fact fails the fixture check on bindSpread; setting `tries` or `lateMarkup` to false fails it on streamedCatchTwo and the reveal fixtures.
- Windowed-list refactor skipped (not small).
