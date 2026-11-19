# Outcome: style-files-links

## Built

- In a styleFiles build, the server code of a component with CSS calls `$$ctx.style(id)` at its first instance (`codegen/markup.ts`); the browser code calls nothing. `Context.style(id, css?)` in `runtime/server.ts` links the stylesheets of the component in the head, once each, in render order. After the head has been sent, the link is written in place. `RenderResult.sheets` carries them; `firstRender` puts them after `options.head` and before the `#head` markup, or before the markup when the document has no `<html>` and `start` is not a function.
- `ClientBundles.components` (component ID to CSS URLs) comes from `hints.json` (`components`, written in `writeBundle` of `vite.ts` from the CSS of the chunk that holds each style module) through `virtual:brumate/client-bundles` to `setClientBundles`.
- `RenderOptions.linked`: the URLs a page links already. `renderPage` (`route-render.ts`) passes its bundle stylesheets, so no stylesheet is linked twice.
- Tests: `it.fails('reaches a render outside the routes')` is a plain `it`; new test for head links in a fixed order, each once; `styles.test.ts` checks the server code calls `style("<id>")` with no CSS and the render code none.

## Deviations

- `packages/brumate/src/codegen/markup.ts` changed (not in `shared`): the server call without CSS.
- `packages/brumate/src/runtime/route-render.ts` changed (not in `shared`): passes `linked`.

## Stubs left

- Client navigation still adopts new head links without waiting (style-files-navigation); PostCSS order test (style-files-postcss).

## Gotchas

- A component's link points at the CSS asset of its chunk, which can carry the CSS of other components too. Link order follows the render order of each page, not a global order.
- A `#defer` body writes its component links in its own markup, in `<link>` elements, and does not skip those the page linked (the request does not know them; the browser loads a URL once). The `x-brumate-defer` request has no head.
- For style-files-navigation: with a `nonce`, the head links differ per request by outerHTML, so a navigation would add them again; that node must compare by `href`.
- `start` as a function receives the component links inside `head`; with a string `start` and no `<html>`, they go before the markup.

## Proposed learnings

- None.

## Verification

- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run test/styles.test.ts test/styles/ test/bundle-urls.test.ts`: 71 passed.
- `pnpm build && pnpm test && node e2e/run.mjs`: unit tests pass; e2e website 75 passed, 0 failed (includes `/ui/selection-indicator` axe color-contrast), todos, tracker, nitro, kit, browser-async pass. ui failed twice under load 11 to 16 (`Disclosure and Transition`, the panel slide); alone, on a lower load, `--only ui --no-build` passes 61 of 61 on this branch and on the base source. Load noise.

## Size

Static count on the website build (gzip -9; HTML plus the linked CSS and JS named in it, not a Chrome run): `/` HTML 15,991, CSS 5,275; `/docs/components/` HTML 30,588, CSS 2,883. Against style-files-modules (HTML 15,989 and 30,583, CSS 5,275 and 2,883): +2 B and +5 B of HTML, CSS equal, so the two views stay at about 189,495 + 7 B, +869 B over release/0.9 (188,633). No Chrome byte run was made.

- Estimated M, actual M.
