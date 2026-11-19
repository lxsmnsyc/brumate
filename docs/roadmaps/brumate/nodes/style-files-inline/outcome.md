# Outcome: style-files-inline

## Built

- `vite.ts`: the client build writes the CSS text of each component with a style module into `hints.json` as its sheet has it: a mark rule ends each style module, and `generateBundle` cuts the text between marks out of the sheets (urls, `@import`, PostCSS and the minifier already applied) and sets the sheets without marks, so later plugins see them clean (marks out of order or missing: no inline CSS, a blocking link); `virtual:brumate/client-bundles` passes it to `setClientBundles` (server build only). `ClientBundles.css` in `runtime/server.ts`.
- `Context.style(id)` writes `<style b-style>` for a component that has CSS in the bundles: in the head in render order, or in place after the head and in a `#defer` body. A component without an entry still gets its link.
- `route-render.ts`: on a first load, a bundle stylesheet that holds component CSS only (`deferred` in hints.json), and whose components with global rules the page rendered, is `<link rel=preload as=style b-sheet>` plus a `<noscript>` stylesheet link, so nothing blocks the paint. Any other sheet (a CSS file imported by a module, a chunk with a lost mark, global rules of a component the page did not render) stays a blocking link. A navigation request (`x-brumate-base`) still gets plain stylesheet links, which the swap waits for.
- `boot.ts` (`applySheets`): at `load`, a `b-sheet` preload becomes a stylesheet, or goes if the loader linked that URL. `sheets.ts` `linkPreloads`, called in `navigate.ts` on a fetched page: a static host ignores the request header and sends the first-load form, and the swap must wait for those sheets.
- `navigate.ts` `updateHead`: `<style b-style>` is the same by component ID, not by markup (a nonce changes the markup).
- Tests: `test/styles/style-files.test.ts` and `test/bundle-urls.test.ts` rewritten for inline styles, preloads and navigation links, and inline rules equal to the sheet rules. e2e `website.mjs`: the stylesheet-wait step waits for the home sheets first.

## Proof

- base (`feat/style-files`, earlier review): first-load FCP 692 to 1928 ms on `/` and 692 to 1952 ms on `/docs/components/` (Slow 4G, cpu 4), 3 and 4 blocking CSS requests.
- branch, against `f5cd683b` (20 runs, ABAB batches of 5, load at most 4): Slow 4G + cpu 4 FCP `/` 684 vs 696 ms (+12), `/docs/components/` 684 vs 684 ms (0), both within noise; 0 render-blocking CSS requests. Fast 4G: 340 vs 340 and 336 vs 340. Unthrottled: 72 vs 80 and 72 vs 88 (within noise). Warm loads and the docs and ui swaps within noise on all profiles. Tables in `../../reviews/style-files-fcp.md`, round 2.
- HTML gzip, first load: `/` 20511 B (base 20746, style-files about 16400); `/docs/components/` 34317 B (base 34284, style-files about 31400).

## Deviations

- Files outside `shared`: `packages/brumate/src/runtime/boot.ts` (the `load` step) and `e2e/suites/website.mjs` is in shared.
- The warm and swap checks compare with `f5cd683b`, not with `feat/style-files` before this node; the earlier review had those within noise of the base on every profile.

## Stubs left

- None.

## Gotchas

- Known limit: a global rule of a component that renders after the first render (a `#defer` or `#loading` body) counts as not rendered, so its sheet stays a blocking link.
- A sheet that Vite splits per chunk with more than one CSS file, or an external `@import` hoisted by Vite, is not cut: that sheet stays blocking and its components get links.
- Every page carries each component's CSS twice (inline and in the bundle sheet that loads after `load`), so HTML gzip is back at the base size. A later node could drop the inline copy from a page whose bundle sheets are already cached (a cookie or a header), or prune the sheets the page does not render.
- The inline CSS is the scoped CSS of the component, minified. The linked sheet goes through Vite's CSS pipeline, so a PostCSS or Lightning CSS transform (style-files-postcss) must apply to both, or the two copies differ.
- Rule order: inline rules come first, in render order, and the sheets apply later. Component rules are scoped by `b-c-<hash>`, so equal-specificity conflicts across components are rare; the test compares the inline selectors with the sheets.
- A static host sends the first-load page to a navigation; `linkPreloads` handles it. Any new head link written for first loads only must be handled there too.

## Proposed learnings

- A first-load-only form of markup needs a test against the static host, which ignores `x-brumate-base` | the e2e website suite is prerendered | e2e/suites | yes

## Verification

- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm build && pnpm test && node e2e/run.mjs`: pass (brumate 3272 unit tests; e2e website 79, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6), including `/ui/selection-indicator` contrast.
- Earlier runs: the website suite failed on "a visit that a newer one replaced" (the static-host gap above, fixed) and once on "Escape left the tooltip" under load 8 to 9 (passed alone).
- Fix round 1 (fresh review): `pnpm build && pnpm test && node e2e/run.mjs` pass again (website 79, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6); Slow 4G re-run in the review file: `/` 680 vs 688 ms, `/docs/components/` 680 vs 676 ms, 0 blocking requests.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 33.5 kB / 13.9 kB gzip (no change from style-files-navigation: 33.2 kB / 13.9 kB).

## Size

- Estimated M, actual M.
