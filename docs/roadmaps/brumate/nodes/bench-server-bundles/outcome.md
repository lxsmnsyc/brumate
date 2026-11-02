# Outcome: bench-server-bundles

## Built

- `benchmarks/brumate/adapter.js`: reads `chunks`, `styles` and `members` from `.brumate/hints.json` of each client build and passes them to `page()`. These are the fields that `virtual:brumate/routes` passes to `handleRoute`.
- `benchmarks/brumate/{src,dashboard/src,rows/src}/server.ts`: `page()` takes the bundles and passes them to `renderToStream()` as `bundles`, so the state records name the app bundle in `b-load`.

## Cause

Confirmed on next f8848c37: the todos click checks failed (counter, toggle, add). The bench servers called `renderToStream()` without `bundles`, so no record had `b-load`. The loader of a build imports only what `b-load` names, so `load(id)` returned undefined, as for a component with no client code. The page stayed static with no error.

## Deviations

- None of the examples has the gap. Each `src/server.ts` re-exports `handle` from `virtual:brumate/routes`, and the Nitro example calls `handle` too. No example calls `render()`, `renderToStream()` or `renderPage()` itself, so no example or e2e step changed.

## Stubs left

- None.

## Gotchas

- The sizes that #425 reported were right. The adapter adds a modulepreload link for every chunk in `hints.json`, the app bundle included, so the browser fetched the app chunk and did not run it. The fix changes the clicks, not the bytes.
- `pnpm bench` rebuilds packages/brumate, so a typecheck in the same worktree during a bench run fails on a missing `dist/index.js`.

## Proposed for brumate

A server that calls `render()` without `bundles` in a build gets a page with no client code and no error. That is a bug for users too. Two options, as a follow-up node:

1. In a server build, the plugin gives `brumate/server` the bundles of the client build as the default, as it does for the routes module. `render()` then works with no options.
2. At least, fail loudly: a build render whose records have scopes with client code and no `bundles` throws, or the loader logs an error when `load(id)` misses and no record of the page named a bundle. The server cannot tell a build from dev today (dev needs no `bundles`), so the plugin would have to tell it.

Option 1 also removes the hand-written `hints.json` reading from the bench adapter.

## Verification

- `pnpm bench --only brumate --scenario todos|dashboard|rows` on the branch: all click checks pass. Before the fix, todos reported FAILED for all three clicks.
- `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1,953 passed).

## Size

Gzip, `pnpm bench --only brumate`. main is cc450f80, next is f8848c37.

|                              |     #425 reported |  next, before fix |   next, after fix |              main |
| ---------------------------- | ----------------: | ----------------: | ----------------: | ----------------: |
| todos, JS before `load`      | 13.4 kB (5 files) | 13.5 kB (5 files) | 13.5 kB (5 files) | 14.9 kB (5 files) |
| todos, click checks          |                   |            FAILED |              pass |              pass |
| todos, client JS in dist     |           27.2 kB |           27.4 kB |           27.4 kB |           28.7 kB |
| dashboard, JS before `load`  |           22.8 kB |                   | 22.9 kB (4 files) | 24.6 kB (4 files) |
| dashboard, click checks      |                   |                   |              pass |              pass |
| dashboard, client JS in dist |           36.6 kB |                   |           36.8 kB |           38.3 kB |
| rows, client JS in dist      |                   |                   |           27.2 kB |                   |

- Estimated S, actual S.
