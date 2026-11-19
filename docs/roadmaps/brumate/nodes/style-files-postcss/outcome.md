# Outcome: style-files-postcss

## Built

- Nothing in `packages/brumate/src`: the style modules from style-files-modules already go through Vite's CSS pipeline, and the inline copy from style-files-inline is cut from the built sheet, so both copies take the same transforms.
- `packages/brumate/test/styles/style-files-postcss.test.ts` (new): builds a client and a server for three configs and compares the sheet with the inline `<style b-style>` text.
  - PostCSS plugin: the plugin's value is in both copies, which are the same text.
  - `css.transformer: 'lightningcss'` with `targets` and `build.cssTarget`: `inset` is lowered in both copies, and the project's PostCSS plugin does not run.
  - A PostCSS plugin that drops the mark rules: no inline CSS for those components, a blocking link, the sheet holds their CSS, no mark is left.
- Dev and relative-base builds (follow-up commit, on the coordinator's call): `compileFile` in `vite.ts` runs `preprocessCSS` on the scoped CSS when the CSS stays inline, and compiles again with `CompileOptions.css` (new, `compile.ts`) when the output differs. The result is cached per source, so the hot update (`getShape` of the new compile) sends the transformed CSS. Tests in `style-files-postcss.test.ts`: a dev render, a dev hot update message and a relative-base build, all with the PostCSS plugin.
- Fix round 1 (fresh review): `compileFile` records the files the CSS pipeline read (`cssImports`, `dependents`, watcher), so a change to an imported CSS file compiles the component again and sends the hot update; `updateClient` drops the cached compile of the dependents first. In dev, `devUrls` rewrites a relative `url()` to the file's dev URL. `hasGlobalRules` counts an `@import` as global. Tests added for each. A relative-base build leaves `url()` as written (no URL fits a page at any depth), documented.
- `website/docs/styles.md`: "On the page" now describes the two copies, and a new section "What runs on component CSS" lists the build steps, the Lightning CSS case, and dev and relative base.

## Deviations

- First commit: no source change. Follow-up commit: `packages/brumate/src/compile.ts` (option `css`) is outside `shared`; `vite.ts` is in `shared`.

## Stubs left

- `url()` inside a file that component CSS imports is not rewritten in dev or with a relative base (`preprocessCSS` has no URL resolver).
- `url()` in a relative-base build stays as written.

## Gotchas

- Vite runs PostCSS or Lightning CSS, never both: with `transformer: 'lightningcss'` the project's PostCSS plugins do not run on any CSS.
- `css.lightningcss.targets` alone does not keep lowered features: the minifier reads `build.cssTarget` and joins them again. Set both.
- A plugin that removes rules with only custom properties removes the marks; the fallback is safe but the first paint blocks on the stylesheet.

## Proposed learnings

- None.

## Verification

- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run test/styles test/styles.test.ts` in packages/brumate: 7 files, 74 tests pass.
- Follow-up: lint (0 errors), format:check, typecheck, style + vite + bundle-urls tests (9 files, 122 passed), `node e2e/run.mjs --only website` (79 passed, 0 failed).
- Fix round 1: lint 0 errors, format:check, typecheck, style + vite + bundle-urls tests (126 passed), `node e2e/run.mjs --only website` (79 passed, 0 failed).
- `pnpm build && pnpm test && node e2e/run.mjs`: pass (exit 0 for tests and e2e).

## Size

- Estimated M, actual S: the pipeline already did the work; the node became tests and docs.
