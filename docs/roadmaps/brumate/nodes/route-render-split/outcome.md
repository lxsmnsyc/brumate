# Outcome: route-render-split

## Built

New module `packages/brumate/src/runtime/route-render.ts`. Moved from `server.ts` with no change in code:

- `renderView`, `viewIds`, `viewComponent` (render a view and its slots)
- `renderPage` and `renderDeferred` (the page response and the `#defer` body response)
- `renderRoute` (runs a posted form function, the kept page, then `renderPage`)
- `pageCache`, `cacheControl`, `warnedPrivate` (only `renderPage` used them)

`renderPage` and `renderRoute` are exported from `route-render.ts`; `server.ts` imports them. `server.ts` now exports the helpers that the moved code uses and that other code in `server.ts` uses too: `ResolvedView`, `respond`, `NOTHING_PENDING`, `clientBundles`, `deferTarget`, `resolveView`, `runAction`, `keptPage`, `keepPage`, `pageKey`, `renderError`, `errorAnswer`, `logError`. They are not re-exported from the package entry. Public exports are unchanged (`RouteOptions` stays in `server.ts`).

## Deviations

- Helpers `pageCache`, `cacheControl`, `warnedPrivate` and `renderDeferred` moved too, since only `renderPage` uses them.
- `route-render.ts` and `server.ts` import each other. oxlint `import/no-cycle` is silenced with a disable comment on each import. The calls run after both modules load, and `warnedPrivate` is the only top-level value in the new file.
- Added `docs/roadmaps/brumate/nodes/route-render-split/` (this folder) to the worktree; the worktree had no copy.

## Stubs left

None.

## Gotchas

- partial-server-render edits `renderPage`, `renderRoute`, `viewComponent` in `route-render.ts`. `renderError` and `resolveView` stay in `server.ts`.
- `deferTarget` stays in `server.ts` because `handleRoute` uses it.

## Verification

Run in the worktree on the loaded machine: `pnpm lint` (no errors), `pnpm format:check`, `pnpm typecheck` (pass), `pnpm test` (brumate 3261 of 3261 pass; 10 ui tests timed out under load, and the two that failed on the rerun of those files passed alone), `node e2e/run.mjs` (191 ok, exit 0). The diff only moves code, adds `export`, and fixes imports. No test is edited.

## Size

S, as planned. `server.ts` 4845 -> about 4525 lines; `route-render.ts` about 330 lines.

### Website dist against origin/release/0.9

Built `website` on this branch and in a scratch worktree of `origin/release/0.9`, then compared `website/dist` (756 files each, same file set). Chunk hashes, the per-build ID and the `script-names` hash differ on every build, so I replaced them with placeholders before comparing. After that, 753 files are identical, including all client assets and every prerendered HTML page. Three files differ:

- `server/brumate-routes.js`: same size (10220002 bytes). The moved functions sit in another order.
- `client/assets/run-*.js` (+215 bytes): the Repl chunk bundles `brumate/server`, so it carries the moved code too (here `pageCache` shows as a separate function).
- `client/.brumate/builds.json`: the build timestamp.

All three are server-code differences from the move, or the timestamp. No page script or style changed.
