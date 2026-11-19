# Outcome: style-files-tests

## Built

- `packages/brumate/test/styles/block-styles-live.test.ts`: a describe "live style of a block with linked stylesheets" compiles with `styleFiles` (and asserts no `$$css` in the output), resumes a block with `${}` variables, and checks a signal change of one row, a keyed reorder and a row the browser adds, with no `<style>` in the head. This was the one gap; the build test, the hints test and the PostCSS tests came with modules, links, inline and postcss (`style-files.test.ts`, `style-files-postcss.test.ts`).
- `website/docs/styles.md` "On the page": assets per bundle plus shared chunks, the two copies, non-blocking sheets, navigation and `#defer` waits, dev inline. "What runs on component CSS" (postcss node) already covers the pipeline, Lightning CSS, `url()` limits, `@import` as global and the relative base.
- `.changeset/style-files.md`: one minor changeset for brumate. No earlier style-files changeset existed.

## Story acceptance (style-files brief)

The story brief has no Acceptance list. Its Goal and Why are checked here.

| Item | Result | Evidence |
| --- | --- | --- |
| CSS of components goes through Vite's CSS pipeline into cacheable `.css` assets in a build | pass | `style-files.test.ts` "is in the stylesheets of the bundles"; hints name them |
| No `$$css` string in modules, no component `<style>` in pages as the only copy | pass | "is in no module of the client build, and in no `$$css` of the server build"; the page holds inline `<style b-style>` on purpose (first paint) |
| Dev keeps inline `<style>` and the `textContent` swap | pass | `style-files-postcss.test.ts` dev render and hot update tests; `liveBlocks` unchanged |
| Page no longer sends CSS twice | partial | CSS leaves the JS; the page still carries it inline and in the bundle sheet by design (inline outcome, Gotchas) |
| Project PostCSS, Lightning CSS and targets run on `.brm` styles | pass | `style-files-postcss.test.ts` (PostCSS, Lightning CSS, dev, relative base) |
| Order of equal-specificity rules does not depend on the route taken | pass | "writes each component once in the head, in the same order on every request"; navigation outcome (`updateHead` by component ID) |
| `${}` variables, `targets`, block styles, `<style global>` keep working | pass | build test (`var(--s-…)`, `b-c-…-1`, global rule); new linked-CSS live tests |
| No unstyled frame on first load or navigation | pass | inline FCP table in `reviews/style-files-fcp.md`; e2e website navigation steps |
| Byte gate | missed, waived | modules outcome: +862 B gzip on two views; the maintainer chose to continue, size is not a gate |

## Deviations

- None. Only `block-styles-live.test.ts`, `website/docs/styles.md`, `.changeset/style-files.md` and this node's folder changed.

## Stubs left

- None.

## Gotchas

- `block-styles-live.test.ts` shares one `styleFiles` flag across its describes; the new describe resets it in `afterAll`.

## Proposed learnings

- None.

## Verification

- `pnpm lint` (0 errors, warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run test/styles/block-styles-live.test.ts`: 12 passed.
- `pnpm build && pnpm test && node e2e/run.mjs && pnpm --filter website check:samples`: exit 0. brumate 3294 tests, e2e website 79, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6; 70 samples, 0 problems.

## Size

Final bytes, static count on the website build of this branch (gzip -9; HTML plus the stylesheets it links; JS is unchanged from modules: -98 B and -2 B, 84,148 and 50,617 B). No Chrome run was made.

| View | HTML | Linked CSS | HTML + CSS | Base HTML (no CSS) | Diff |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 19,950 | 5,355 | 25,305 | 20,313 | +4,992 |
| `/docs/components/` | 33,356 | 5,058 | 38,414 | 33,455 | +4,959 |

Cold cache; the sheets are cached after view 1 and shared across pages. Against the byte gate (+862 B on two views, warm cache), the final HTML is back near the base size because inline CSS returned. The maintainer chose this for the first paint (`reviews/style-files-fcp.md`).

- Estimated S, actual S.

Landed on feat/style-files as ab985e2f.
