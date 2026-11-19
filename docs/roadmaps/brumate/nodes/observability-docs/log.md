# Log: observability-docs

- 2026-11-19: read the outcomes of core, otel and browser. The brief names `packages/brumate/skill/**`; the skill is `packages/brumate/skills/brumate/SKILL.md`, edited there.
- The page is in the Production group of the sidebar, linked from the `onError` section of `routing.md`.
- Only one sample is live (`brm live`, the click that calls a server function). The `ts` samples are not compiled by `check:samples`; I checked them against `examples/trace` and the plugin options table.
- Sizes on the page come from the browser outcome (+1.15 kB gzip with `onTrace` on, 0 with it off).
