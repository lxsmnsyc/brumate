# Log: docs-generator

- Froze the props-table contract first (commit 157945bd): the `props` fence, the section order, and the four tables.
- Probe: read `ButtonOwnProps` with `parse` of brumate (module script AST, defaults from the `$props` destructuring, doc comments from the source before each member). Rows were right on the first try, so the plugin grew from the probe.
- No oxc-parser in website. `parse` of brumate gives the program with offsets in the whole file, so the generator needs no new dependency.
- The table is HTML in the page (a `raw` part), so DocPage.brm and a PropsTable.brm component were not needed. The client stays unchanged.
- website has no vitest. website/vitest.config.ts is a plain object that aliases `vitest` and `brumate` (to the source), and `pnpm --filter website test` runs the vitest of packages/ui. Needs no install.
- check:samples reads website/ui too. A broken `brm live` block in website/ui/zz-broken.md gave `1 problems` and exit 1; removed after.
- The doc comment of `href` in Button.brm names React Aria, and the table shows it. Not edited (packages/ui is not owned here).
- Needed builds in the fresh worktree: tsdown in packages/brumate, packages/tsc and packages/language-core, for the vite build and brumate-tsc.
