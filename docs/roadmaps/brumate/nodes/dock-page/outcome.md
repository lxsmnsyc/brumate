# Outcome: dock-page

## Built

`packages/brumate/src/runtime/devtools-panel/page.ts` draws the Page workspace as the prototype does. `drawPage(ctx, into)` is the one draw. It shows four metrics (Components with scopes in the browser, Page state in kB, Handlers run with server calls, and Ready in with the server and browser split from navigation timing, or Open for when the browser has no timing). Below, two columns. The first has Page state with its size and the first record, a bar and legend by component, and the table of values (largest first, over 1 kB marked, with the code that reads each), then Blocks with their states, Trigger now, and the fallback toggle. The second has Environment (brumate, vite, route, open for) and buttons to Issues (with the count) and Activity. Every number is read from the running page. Styles are injected into the shadow root once (`style[data-page]`), as issues.ts does.

`page.tabs` keeps `overview`, `state` and `blocks`, all pointing at `drawPage`, so the old tab bar works until dock-shell replaces it. The first draw is sync, and a second draw follows when component names load from the dev server.

The Report tab is removed: its draw, the `report` entry of `Tab` in `workspace.ts`, and the Report line in `TABS` of `devtools-panel.ts`. The Overview's components table is removed too, since the prototype does not have it.

Tests: `packages/brumate/test/devtools-dock-page.test.ts` (2 tests).

## Deviations

- Edited outside the owned paths, each a minimal removal: `devtools-panel.ts` (the Report line in `TABS` and the comment), `workspace.ts` (`'report'` in `Tab`, two comments), `test/devtools.test.ts` (one assertion: the first tab now shows "Environment", not the components table).
- The prototype's "What the browser loaded" bar (brumate, each component module, page state) needs per-module sizes that the page does not have in dev. The bar shows the page state by component instead.
- The prototype's Environment rows "layouts" and "render" are left out: no devtools data gives them.

## Stubs left

- None.

## Gotchas

- `style.ts` (dock-shell's) still has `pre.report`, and `dom.ts` still has the `report` icon. Remove both after dock-shell lands.
- If dock-shell's rewrite of the tab bar conflicts on the `TABS` line or the changed assertion in `devtools.test.ts`, keep their version and drop the Report line.
- The Page nav's `ctx.select('issues', 'errors')` and `ctx.select('activity', 'log')` name old tabs, as the contract says until the shell replaces them.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-page.test.ts test/devtools.test.ts`: 16 passed.
- `pnpm lint` (no warnings in the new files), `pnpm format:check`, `pnpm --filter brumate typecheck`: pass. See the report for the full check.

## Size

- Estimated S, actual S.
