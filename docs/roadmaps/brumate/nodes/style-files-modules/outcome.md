# Outcome: style-files-modules

**The byte gate is missed: two views cost 189,495 B gzip on the branch and 188,633 B on the base, +862 B (+0.46%).** The maintainer chose to continue past the miss (2026-11-18).

## Built

- Compile option `styleFiles` (`packages/brumate/src/compile.ts`), carried as `Plan.styleFiles` (`plan.ts`). With it, `codegen/render.ts` and `codegen/server.ts` write no `const $$css`, and `codegen/markup.ts` writes no `style(id, $$css)` call. `CompileResult.css` still holds the scoped CSS, not minified.
- The Vite plugin (`vite.ts`) sets `styleFiles` in builds with an absolute base (`styleFiles()`: `!isServe && !relativeUrls && !relativeBase`). Dev and a relative base (`./`, `''`, `renderBuiltUrl`) keep `$$css` and inline `<style>`. `relativeBase` is read from the user config in the `config` hook, because Vite resolves a relative base to `/` in a server build, where `relativeUrls` is then false.
- Style module: `<file>.brm?brumate-style&lang.css` (`STYLE_QUERY`, param `STYLE_PARAM = 'brumate-style'`). `load` returns `result.css`; `transform` skips it; Vite's CSS plugin then runs on it (PostCSS config, Lightning CSS if set, the minifier).
- `bundles(kept, styled)` returns `Map<root file ID, Bundle>`, where `Bundle = { members: string[]; styles: string[] }` (files). `styles` is every component with CSS the root can render, in walk order (a component before those it renders). `buildBundles()` computes `kept` (client code) and `styled` (CSS) and calls it.
- `buildBundles()` is computed once per build (`builtBundles`, reset in `buildStart`); the manifest and every bundle module read it.
- `bundleModule(root)` writes the style imports first, then the client modules, so the chunk's CSS asset is in that order.
- Style roots: a root with CSS and no client code. `manifest()` puts it in `styleRoots` (not `bundleMembers`); `virtual:brumate/bundles` gives it an `import()` so its chunk and CSS are built. In `hints.json`, `bundles[root]` holds only its CSS URLs; `chunks`, `members` and `styles` leave it out, so no `b-load` names it.
- Data the next children use, in `website/dist/client/.brumate/hints.json` (`ClientHints`): `bundles[rootId]` = chunk URLs then CSS URLs (`viteMetadata.importedCss` of the bundle chunk and the chunks it imports); `styles[rootId]` = CSS URLs relative to the loader, for client-code bundles only. `renderPage` in `runtime/server.ts` already links every CSS URL of `bundles[id]` for `viewIds(view)` in the head, so full loads are styled with no runtime change. There is no per-component map yet (component ID to stylesheet URL); style-files-links builds it from `Bundle.styles` plus the chunk graph.
- Shared chunks: Vite split them without a `manualChunks` rule. On the website: `Icon`, `VisuallyHidden`, `DocsShell`, `LiveSample`, `TreeItem`, `ColorThumb` and others are CSS assets of their own, and the root layout bundle `Layout_gm4yo9` (layout, Header, BrandMark, Search) is linked by every page and cached after view 1.
- Tests: `test/styles/style-files.test.ts` (new) builds a small app (client + server), checks no `$$css` or component CSS in any JS chunk, the CSS assets hold the global rule, a scoped rule, `var(--s-…)` and a block rule (`b-c-…-1`), `/` links them with no `<style>`, and a page with no client code links its stylesheet. A third build with `base: './'` (its own plugin instance) checks the page keeps an inline `<style>`, the server modules keep `$$css`, and the client build has no `.css` asset. An `it.fails` test renders `Card` with `renderToStream` outside the routes and expects its CSS. `test/styles.test.ts` adds a `styleFiles` build test; the `hideNames` minify test stays for the inline path. `test/styles/block-styles.test.ts` compiles its build case with `styleFiles` and checks the HTML has no `<style>`.

## Deviations

- `packages/brumate/src/compile.ts` and `packages/brumate/src/plan.ts` changed (not in `shared`): the option and the plan field. Reusing `hideNames` would drop the CSS of every direct `compile()` caller that hides names.
- A relative base keeps inline styles. A linked asset cannot be resolved from a page at any depth, and the loader path (`b-load`) adds the link only after the script runs.
- Only one style test asserted `const $$css`; with a separate option it still passes, so it was kept and a new build test added next to it.

## Stubs left

- **Regression found by e2e, left for style-files-links:** a component the page renders on the server from a bundle that is not a view bundle (the `/ui` demos, such as `SelectionIndicatorToggleDemo`) gets its stylesheet only from `b-load`, so the loader adds the link after the script runs. Before, its `<style>` was inline before the first instance. `node e2e/run.mjs` fails `/ui/selection-indicator: color-contrast` (dark theme) on the branch, twice. The fix is the per-component link the server writes at the first instance (child 2), or a `<link>` in place of the inline `<style>` until then.
- **`render()`/`renderToStream()` outside routes** (a custom server) gets no component CSS in a build: only `renderPage` links bundle CSS, and `b-load` names only bundles with client code. `it.fails('reaches a render outside the routes')` in `test/styles/style-files.test.ts` holds it; style-files-links fixes it with the link each component writes at its first instance, and turns the test into `it`. Turning `styleFiles` off for apps without routes was not done: an app with routes can also render outside them (as `test/bundle-urls.test.ts` does), so "no routes" does not detect the case.
- Client navigation adopts the new head links without waiting for them (possible unstyled frame), and `keepStyles` still handles only `<style b-style>`. style-files-navigation.
- PostCSS / Lightning CSS order on scoped CSS is not verified by a test. style-files-postcss.
- A component first rendered in the browser in a build gets its CSS from the bundle's stylesheet, which the page links or `b-load` adds; no `addStyle` call remains in build code.

## Gotchas

- A bundle carries the CSS of everything its root can render. On `/docs/components/` the `LiveSample` CSS includes `AnatomyFigure` and `StyledExample`, which that page does not render. This is the main reason view 2 saves almost nothing.
- CSS inline in the HTML gzips better than the same CSS in a file (the class names repeat in the markup): view 1 saves 4,324 B of HTML for 5,275 B of CSS.
- Vite resolves `base: './'` to `/` in a server build. Read the user's base in the `config` hook (`relativeBase`) when the server must agree with the client.
- The plugin keeps compiled files across the builds of one process (`compiled`, keyed by source). Two builds with different bases need two plugin instances.
- The bundle chunk of a style root is a near-empty JS file that nothing loads; it exists only so Vite emits the CSS.
- `REPL` (`run-*.js`) still contains `$$css`: it compiles in the browser in dev mode. The test that checks chunks must skip it.

## Proposed learnings

- Measure bytes on the real build with the same script for base and branch; simulated concatenations missed about 1 kB here | the spike predicted -296 B, the build gave +862 B | docs/roadmaps | no

## Verification

- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run test/styles.test.ts test/styles/` in packages/brumate: 6 files, 55 tests pass.
- Website build on branch and base (`d713634e`), measured twice each, identical bytes.
- `pnpm test` at the root: brumate 3265 of 3266 passed; `differential-3.test.ts > ResolveGoneChild` failed under load and passed alone (with `bundle-urls` and the style tests, 210 tests). The run stopped at that failure, so the other packages ran after it on their own: all pass (ui 841 + 1 expected fail, examples, tsc, language-server, vscode).
- `node e2e/run.mjs`: todos, tracker, nitro, kit, ui, browser-async pass; website 70 passed, 1 failed (`/ui` utility pages: axe `color-contrast` on `/ui/selection-indicator` in dark). Rerun of website alone (`--no-build`): 72 passed, 1 failed, same page and rule. Cause in Stubs left. The base run could not be repeated (the scratch base worktree was removed before it ran); the cause is read from the page: the demo's CSS is named only in `b-load`.
- After the full run, one fix: `compileOptions` uses `styleFiles()` so a relative base keeps inline styles (it used `!isServe`); `bundle-urls` and the style tests were rerun on it.
- Fix round 1 (review): relative-base build test (found that the server build of a relative base dropped the CSS: Vite resolves the base to `/` there; fixed with `relativeBase`), `it.fails` for a render outside routes, `buildBundles()` memoized, comment on the style-root hints. Then: lint 0 errors, `format:check` and `typecheck` pass, style tests and `bundle-urls` 69 passed + 1 expected fail; full brumate suite 3266 passed + 1 expected fail, 1 failed (`differential-3 > ResolveGoneChild`, a promise-timing case that also failed in the first full run and passes alone, 142 of 142; it compiles without `styleFiles`).

## Size

Byte gate (gzip -9, Chrome, `/` then `/docs/components/`, warm cache for `/assets/*`):

| Metric                          |    Base |  Branch |   Diff |
| ------------------------------- | ------: | ------: | -----: |
| View 1 `/`: requests            |      53 |      56 |     +3 |
| View 1 HTML gzip                |  20,313 |  15,989 | -4,324 |
| View 1 JS gzip                  |  84,246 |  84,148 |    -98 |
| View 1 CSS gzip                 |       0 |   5,275 | +5,275 |
| View 1 total                    | 104,559 | 105,412 |   +853 |
| View 2 `/docs/components/` reqs |       9 |      11 |     +2 |
| View 2 HTML gzip                |  33,455 |  30,583 | -2,872 |
| View 2 JS gzip                  |  50,619 |  50,617 |     -2 |
| View 2 CSS gzip                 |       0 |   2,883 | +2,883 |
| View 2 total                    |  84,074 |  84,083 |     +9 |
| **Two views in a row**          | 188,633 | 189,495 |   +862 |

- My script reads 188,633 B for the base where the spike's script read 189,381 B (that script was not committed).
- Estimated L, actual M for the code; the gate stopped further work.
