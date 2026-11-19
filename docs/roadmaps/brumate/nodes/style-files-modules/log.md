# Log: style-files-modules

## 2026-11-18

- Base: `d713634e` (`origin/feat/style-files` = `origin/release/0.9`). Branch `feat/style-files-modules`.
- Read the spike prototype (`git diff d713634e 078616fe`). Kept only the idea of a query on the `.brm` file. The prototype tied the change to `hideNames` and emitted one hashed asset per component; this node makes real CSS modules instead (`?brumate-style&lang.css`, as Vue and Svelte do) and lets the bundle modules import them.
- Compile option `styleFiles` (compile.ts, plan.ts) instead of reusing `hideNames`: a direct `compile()` with `hideNames` keeps its `$$css`, and the plugin can keep inline styles for a relative base, where the server could not link an asset from a page at any depth.
- `bundles()` now returns `{ members, styles }` per root. `styles` is every component with CSS that the root can render, in walk order (a component before those it renders). A root with styles and no client code is a style root: its bundle chunk is built for the CSS, `bundleHints` carry only its CSS, and `chunks`/`members`/`styles` of `hints.json` leave it out.
- First test app build (`test/styles/style-files.test.ts`) passed on the first run: three CSS assets, global rule unscoped, `var(--s-…)` kept, block rule on `b-c-…-1`, the static page linked to its stylesheet.
- Vite split the shared components on its own: `Icon`, `VisuallyHidden`, `DocsShell`, `LiveSample`, `TreeItem` and others are CSS chunks of their own, and the root layout's bundle (`Layout_gm4yo9`) is shared by every page, so no `manualChunks` rule was needed.

## Byte gate

Measure script (scratchpad, not committed): serves `website/dist/client` with `cache-control: immutable` on `/assets/*` and `no-cache` on HTML, drives Chrome (`/Applications/Google Chrome.app`, playwright-core 1.64.1) through `/` then `/docs/components/` in one context, and sums `gzip -9` of each HTML, JS and CSS body the server sends. Same script on both builds, each run twice with identical results.

- Base: a scratch worktree at `d713634e`, `pnpm install --frozen-lockfile && pnpm build && cd website && pnpm build`.
- Branch: `pnpm --filter brumate build && cd website && pnpm build`.

| Metric                          |    Base |  Branch |   Diff |
| ------------------------------- | ------: | ------: | -----: |
| View 1 `/`: requests            |      53 |      56 |     +3 |
| View 1 HTML gzip                |  20,313 |  15,989 | -4,324 |
| View 1 JS gzip (48 files)       |  84,246 |  84,148 |    -98 |
| View 1 CSS gzip                 |       0 |   5,275 | +5,275 |
| View 1 total                    | 104,559 | 105,412 |   +853 |
| View 2 `/docs/components/` reqs |       9 |      11 |     +2 |
| View 2 HTML gzip                |  33,455 |  30,583 | -2,872 |
| View 2 JS gzip (5 files)        |  50,619 |  50,617 |     -2 |
| View 2 CSS gzip                 |       0 |   2,883 | +2,883 |
| View 2 total                    |  84,074 |  84,083 |     +9 |
| Two views in a row              | 188,633 | 189,495 |   +862 |

- My script reads 188,633 B for the base where the spike's read 189,381 B; the spike's script was not committed, so the comparison is against my own base run.
- View 1 CSS: `Layout_gm4yo9` 1,978 (root layout, Header, BrandMark, Search), `Icon` 93, `Index_z43tb2` 3,204 (home and its sections).
- View 2 CSS: `DocsShell` 963, `LiveSample` 1,920. The `LiveSample` chunk holds the CSS of `AnatomyFigure` and `StyledExample`, which the docs bundles can render but `/docs/components/` does not. A bundle carries what its root can render, not what a page renders.
- The CSS inline in the HTML compressed better than in files: view 1 saves 4,324 B of HTML for 5,275 B of CSS.
- **Gate missed by 862 B (+0.46%).** Stopped here as the brief says; no tuning.

## Full check

- `pnpm test`: one failure under load (`differential-3 > ResolveGoneChild`), passed alone; other packages pass.
- `node e2e/run.mjs`: website fails axe `color-contrast` on `/ui/selection-indicator` (dark), twice. `/ui` demos are roots outside the view bundles; their CSS is only in `b-load` (`.../SelectionIndicatorToggleDemo_hilovk-*.css`), so it is linked after the loader runs. A regression of this node for style-files-links to close.

## Fix round 1

- The relative-base test failed at first: no `<style>` and no `$$css` in the server build. `resolveConfig({ base: './', build: { ssr: true } })` gives `base: "/"`, so `relativeUrls` was false in the server build and it compiled with `styleFiles`. Fixed by reading the user's base in the `config` hook (`relativeBase`). The test also needs its own plugin instance, since the plugin keeps compiled files across builds of a process.
- Render outside routes: left as `it.fails` for style-files-links (output is the card markup and a state script, no CSS).
