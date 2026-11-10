# Outcome: dock-shell

## Built

The chrome of the dock, as `prototype/index.html` draws it.

- Closed: only the grip on the bottom edge (`button.open` in `devtools.ts`). It is a 6px bar that grows on hover or focus into a tab with the logo, `brumate`, the version and, when there are errors, a red `N issues` badge. No floating bar.
- Open (`packages/brumate/src/runtime/devtools-panel.ts`, the entry): the header has the logo, `brumate`, the version chip (title: brumate and Vite versions), the nav of four workspaces (Inspect, Activity, Issues, Page) with a sliding highlight, the Activity entry count and the red Issues count, then Search (Cmd+K), Pick, Outline updates, Dock side and Close. A footer shows live or paused, the route, components, scopes, page state size, Vite and uptime.
- `devtools-panel/shell.ts` (new): `createChrome`, `drawChrome`, `applySide`, `placeIndicator`, `readPref`/`writePref`, `LIMITS`, the header icons.
- `devtools-panel/search.ts` (new): `createSearch(ctx, actions)`, `collectItems`, `filterItems`. The palette lists components (name and file), issues (message and source) and actions (Pick, dock side, outline updates, open each workspace), at most six lines per group. Arrow keys, Enter, Escape, click outside; focus returns to where it was.
- Side: bottom or right, from the Dock side button or the search. Height, width, side and last workspace are kept in `localStorage` (`brumate:devtools:height`, `:width`, `:side`, `:workspace`). The edge drags the size of the current side; the page gets matching padding.
- Keys: Alt+Shift+D (in `devtools.ts`), Escape and the grip open and close; Escape does nothing while Pick, the search or a field takes it. Focus goes back to the grip on close. Cmd+K opens the search while the dock is open; Ctrl+K does too, but only off macOS and not in a field of the page.
- Closing: `togglePanel` starts a slide-out (class `closed`), ends Pick at once, and removes the dock on `transitionend` with a 400 ms timer as a fallback. Toggling again mid-way slides it back in, and focus on the grip moves to the nav. `.panel.closed` ignores the pointer, and `finishClose` ends Pick if it was armed during the slide. A key resize of the edge redraws the workspaces like a drag.
- The edge is a focusable separator: the arrow keys change the height or width by 16 pixels (64 with Shift) and keep it, like a drag. A drag's window listeners are removed when the dock closes.
- The search holds Tab inside the palette (`aria-modal`).
- Nav: a workspace opens on its first tab; the last workspace opens next time. `openPanel(root, state, 'errors')` and `state.open` still take an old tab name and open its workspace. Arrow keys move along the nav.
- Pick keeps `onPick`, `onHover` and `stopPicking`. Escape that ends Pick no longer closes the dock. The heat marks (`state.written`) clear after each Inspect draw.
- `style.ts`: panel variables and layout of the prototype (`--bg2`, `--line2`, `--sel`, `--ring`, `--accent-text`, `--pink`, `--ease`), header, nav, edge, footer and palette. The old tab bar, `.top`, `.badge` and `.resize` rules are gone.
- Test: `packages/brumate/test/devtools-dock-shell.test.ts` (6 tests): keys and focus, closed grip then open header and version, the four workspaces, kept workspace, side and width, search.

## Deviations

- `devtools.ts` (shared): the grip markup and CSS, the "N issues" label, the version without `v`, and `openPanel(root, state)` on a drag open (no tab, so the last workspace opens). No other change.
- Tests outside the owned paths changed because the 13 tab buttons and the `Pick` text are gone: `devtools.test.ts`, `devtools-dock-activity.test.ts`, `devtools-dock-graph.test.ts`, `devtools-dock-inspect.test.ts`, `devtools-dock-issues.test.ts`. They use `openPanel(shadow, state, tab)`, the nav, or `aria-label="Pick an element"`; `devtools.test.ts` opens the Overview explicitly and expects `1 issue` and `.head .ver`. These files must go in a PR, not a direct commit.
- `workspace.ts` is not owned, so `Workspace.tabs`, `Tab`, `Shell.tab` and `Shell.showTab` stay. The shell sets `shell.tab` to the first tab of a workspace. Whoever owns `workspace.ts` next can remove them once the workspaces stop reading `shell.tab`.
- The Page workspace still draws one old tab at a time (`overview`, `state`, `blocks`, `report`), and the nav opens only Overview, until dock-page lands. Search values and server calls (the prototype's groups Values and Server calls) are not in the list; the brief asks for components, issues and actions.
- The prototype's Clear activity action is left out: the log clear belongs to `activity.ts`.
- None for the slide: the dock slides in and out. A second toggle while it slides out reverses it. With no transition (reduced motion, or happy-dom) it leaves at once, so existing tests that close and reopen keep working.

## Stubs left

- `ctx.split` is still the plain two columns (dock-split-handle). `.split` rules in `style.ts` still assume the `.body` padding.

## Gotchas

- Every `installDevtools` call adds an Alt+Shift+D listener on the window, so a test file that installs several times toggles the dock several times per key. The key test runs first for that reason.
- `finishClose` in `devtools-panel.ts` holds all teardown; the key, resize and drag listeners stay until the slide-out ends.
- Tests that need a slide fake `getComputedStyle(...).transitionDuration`; without a duration the dock leaves at once.
- Workspaces draw after the dev server answers, so a test must poll `.body` after a nav click.
- `Escape` is stopped in the Pick listener (window, capture) so the dock stays open; the search stops it on its input.
- `inspect.ts` throws in happy-dom if its draw resolves after the dock closed (`root.activeElement` with a removed focused element). Close only after the draw in tests.
- `inspect.ts` still defines its own copies of `--sel`, `--ring`, `--accent-text`, `--bg2`, `--line2` on `.ins`; they equal the panel values now and can be deleted by its owner.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools`: 9 files, 90 passed (includes the fast check `test/devtools-dock-shell.test.ts test/devtools.test.ts`).
- `pnpm --filter brumate typecheck`: pass. `pnpm lint`: no errors (warnings are in other files). `pnpm format:check`: pass.
- Root `pnpm typecheck` fails in `examples/*` only, because `packages/tsc/dist` is not built in this worktree.
- Not run: `node e2e/run.mjs`; no browser check of the layout.

## Size

- Estimated M, actual M.
