# Outcome: ui-docs-pages-collections-3

## Built

All five pages of the node, to the pattern of the Select page. Paths are under `website/ui/` and `website/ui/demos/`.

| Page           | Anatomy                                                                                           | Styled                                                                     | Use cases                                                                                        | State                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Table          | TableAnatomy                                                                                      | TableStyled                                                                | TableBulkDemo (delete selected rows, total), TableLargeDemo (3000 rows in a Virtualizer, sorted) | TableStateDemo: own, `$bind`, `$bind` with a request, sort, writes from code              |
| Tree           | TreeAnatomy                                                                                       | TreeStyled                                                                 | TreeBrowserDemo (`onAction`), TreeFolderDemo (single selection, open all)                        | TreeStateDemo: own, `$bind`, `$bind` with a request, `onExpandedChange`                   |
| NavigationTree | NavigationTreeAnatomy                                                                             | NavigationTreeStyled                                                       | NavigationTreeGuideDemo (`selectedRoute`, current ancestor dot), NavigationTreeDisabledDemo      | NavigationTreeStateDemo: own, `$bind`, `$bind` with a request                             |
| Virtualizer    | VirtualizerAnatomy                                                                                | VirtualizerStyled                                                          | VirtualizerPickDemo (10000 options in a ListBox), VirtualizerWindowDemo (`#for` with `window`)   | No state shape. A short "Controlled and uncontrolled" section says why                    |
| Data           | Skipped: `listData` and `treeData` have no tags. The page lists the parts of a page that uses one | Skipped: no markup. The page points to the collection that shows the items | DataListDemo (filter, move to top, remove), DataTreeDemo (move between parents)                  | DataStateDemo: the selection bound to the module, `setSelectedKeys`, `addKeysToSelection` |

- Every anatomy picture draws a `table`, a row or a header cell through a wrapper or a span, since those elements cannot carry a number. The page says where each number sits.
- e2e/suites/website.mjs: table, tree, navigation-tree and virtualizer join the Collections flow (CSS shows, callouts equal the listed pieces, axe finds nothing in light and dark). A new flow acts on the use cases: delete a selected invoice, a long table renders under 100 rows, a Tree press acts and the folder picker saves, a NavigationTree link becomes the current page, the 10000-option list renders under 100 options, the Data filter and a tree move.
- No part code changed.

## Deviations

- BRM167 on DataDemo.brm: it is a gap of the `brumate check` command, not of the Data page. `packages/brumate/src/check-command.ts` compiles with `resolveFromDisk` only, while the vite plugin (`packages/brumate/src/vite.ts`, `resolveModule`) also calls `resolvePackageImport`, which resolves `@brumate/ui/data.brm.ts`. The vite build, the samples check and the e2e flow compile it. All four Data demos report BRM167 under `brumate check`. Not fixed, since the file belongs to brumate-check. The fix is to pass the same `resolveModule` in `compile(source, { filename, path, liveProps })` at line 90.
- `pnpm` refuses to run in the worktree because `node_modules` is a symlink (`ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH`). Packages were built with `npx tsdown`, the website with `npx vite build`, and the checks ran as their underlying commands.
- The Data page has no anatomy picture and no styled example, as listed above. The Virtualizer page has no state demo.

## Stubs left

- None.

## Gotchas

- Children of a closed Tree or NavigationTree row do not render, so a test cannot click them before the row opens. Start a demo open (`expandedKeys=(['parts'])`) when a flow needs its rows.
- The check icon of the shared `ui-box` (`ui-mark`) covers the Checkbox for Playwright, so a click needs `force: true`.
- A `data-mark` must be a literal `data-mark="N"` in the demo, so a template that marks one row needs an `#if` branch per marked row, not an expression.
- A Virtualizer clips a number on its collection. Mark the box with a wrapper around it and the collection with its first row.
- Several demos on one page repeat `aria-label` ("Files"), so a flow scopes by the text next to the demo, such as `.ui-stack` with `hasText`.
- The existing tooltip flow ("Escape left the tooltip") failed on every run here and skips the flows after it. To run the flows of this node, its assert was removed locally for the run and restored. It is not part of the diff.

## Proposed learnings

- Mark a table part with a span inside its cell, never on the `tr`, `thead` or `tbody` | a `::before` badge on a table element adds a column | website/ui/demos | no

## Verification

- `npx oxlint`: pass, warnings of other files only. `npx oxfmt --check`: pass. `brumate-tsc --noEmit` in website: pass. (`pnpm lint`, `pnpm format:check` and `pnpm typecheck` could not run as scripts, see Deviations.)
- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx vitest run` in website: 259 passed (anatomy and props tests).
- `npx vite build` (client and ssr) in website: pass.
- `node e2e/run.mjs --only website --no-build`: see the PR description for the last run. Only `/docs/control-flow` fails, as on main, and the tooltip flow as in Gotchas.
- axe: no violation on the four pages in light and dark (the Collections flow).
- `npx brumate check` on the new demos: no errors except BRM167 on the Data demos.

## Size

- Estimated M, actual M. 24 demos, five pages and two e2e flows.
