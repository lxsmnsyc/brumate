# Outcome: dock-split

## Built

`packages/brumate/src/runtime/devtools-panel.ts` (489 lines) is the entry. It keeps `openPanel`, `togglePanel`, re-exports `layoutGraph`, and holds the shell: the tab bar, the header, the drag of the height, Pick with its hover card, the chrome counts and the draw loop. The tabs are drawn by modules in `packages/brumate/src/runtime/devtools-panel/`. Behavior is unchanged: the old tab bar shows the same 13 tabs.

| Module | Lines | Exports |
| --- | --- | --- |
| `workspace.ts` | 173 | Types `Workspace`, `DockContext`, `Shell`, `Columns`, `SplitOptions`, `Tab`, `TabDraw`, `WorkspaceId`. `KINDS`, `createShell(tab)`, `drawTabOf(tabs, ctx, into)`, `splitPlain()`, `chooser(ctx, current)` (the component select of Graph and Report). |
| `style.ts` | 180 | `STYLE`, the CSS string. |
| `dom.ts` | 140 | `element`, `svg`, `ICONS`, `IconName`, `icon`, `iconButton`, `pill`, `row`, `card`, `key`. |
| `format.ts` | 93 | `readType`, `ms`, `seconds`, `kilobytes`, `measureSize`, `stateBytes`, `clip`. |
| `info.ts` | 206 | Dev-server data and scope helpers: `ComponentInfo`, `GraphNode`, `Anchor`, `known`, `componentInfo`, `loadComponents`, `collectModules`, `countBlocks`, `countScopes`, `readValue`, `source`, `place`, `roots(state)`, `findScope(state, id)`, `findAnchor(state, scope, anchor)`, `drawReads`. |
| `stack.ts` | 206 | `Frame`, `parseFrames`, `mapFrames`, `frameUrls`, `codeView` (source fetch and highlighter). |
| `graph.ts` | 479 | `layoutGraph`, `drawGraph(ctx, id, instance, info)` (frame, side panel, pan and zoom, hot marks), `HOT_MS`, `nodeColor`. |
| `inspect.ts` | 402 | `inspect: Workspace` with `tabs` scopes (Components), elements, graph. |
| `activity.ts` | 653 | `activity: Workspace` with `tabs` log, timeline, effects, navigation, server. |
| `issues.ts` | 135 | `issues: Workspace` with `tabs` errors. |
| `page.ts` | 274 | `page: Workspace` with `tabs` overview, state, blocks, report. |

Imports are acyclic. `info.ts` does not import `workspace.ts`; `workspace.ts` imports `info.ts`.

`contracts/dock-workspace-api.md` holds the final interface (status not changed).

## Deviations

- The contract's `Workspace` got a `tabs` map and `draw` may return a promise, so the old 13-tab bar keeps working on top of four workspaces. `draw(ctx, into)` of a workspace draws `ctx.shell.tab` when it holds it. Dock-shell deletes `tabs` and `shell.tab`.
- The context also has `outline(scope?)` and `pick()`, because Components and Elements need them. `split` returns `{ box, first, second }` (a box is needed to place the columns). `icon` is `IconName`.
- `badge` is not implemented by any workspace. The tab bar keeps its per-tab counts in `drawChrome` of the entry.
- The branch base lacks the brief and the contract (they were committed on main later). The contract file is added on this branch from main's copy, so it may conflict with main's copy when merged.
- Local variables were renamed where moving them into module scope made them shadow an import: `place` to `spot` in `graph.ts`, `key` to `route` in the navigation tab, the hover function `inspect` to `showCard` in the entry.

## Stubs left

- `ctx.split` ignores its options and returns `splitPlain()`: `div.split > div.list + div.detail`. Components and Errors use it. Dock-split-handle replaces it.
- `ctx.drawCallDetail` returns an empty state. Dock-call-detail fills it.
- `ctx.drawGraph(scope, info)` draws the old graph; the Graph tab itself is `drawGraphTab` in `inspect.ts` (toolbar, chooser, empty states) around `drawGraph` of `graph.ts`. Dock-graph rewrites `graph.ts`.

## Gotchas

- Shell state: every field of the old closure is on `ctx.shell` (`selected`, `selectedScope`, `selectedError`, `selectedFrame`, `editing`, `paused`, `filter`, `logSearch`, `shown`, `frozen`, `picked`, `graphNode`, `view`, `cooling`, plus `panel`, `showTab`, `endPick`, `tab`). The only module-level state left is `docked` in the entry (which shell is open) and the caches in `info.ts` and `stack.ts`.
- `--isolatedDeclarations` is on: exported constants and parameters need explicit types.
- The dynamic import of the highlighter in `stack.ts` is `../../highlight.ts`.
- Writing `shell.tab = 'x'; ctx.draw()` still switches tabs. `ctx.select(workspace, tab)` does the same through the workspace.
- `drawServer` does not use the context (`_ctx`).
- `docs/architecture/*.md` still name `runtime/devtools-panel.ts` only, which stays the entry.
- Lint leaves one warning in the moved code (`segment` in `activity.ts` could move out of `drawTimeline`).

## Verification

- `npx tsc -p packages/brumate --noEmit`: clean for `src` (the `test/` errors only show without a built `dist`).
- `npx oxlint`: no errors; `npx oxfmt --check`: pass.
- `npx vitest run test/devtools.test.ts` (in `packages/brumate`): 14 passed. Full `npx vitest run`: 82 files, 3025 passed, 1 skipped.
- A throwaway equivalence test compared the `.panel` HTML of the old file and the new one over every tab and the interactions listed in `log.md`: equal. It is not committed.
- Not run: `node e2e/run.mjs` (needs Chrome and a long run).

## Size

- Estimated M, actual M. About 3,100 lines moved; the entry is 489 lines and the workspace modules 135 to 653.
