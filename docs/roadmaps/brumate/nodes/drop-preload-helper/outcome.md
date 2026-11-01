# Outcome: drop-preload-helper

## Built

- `packages/brumate/src/vite.ts`: a client build serves its own `\0vite/preload-helper.js` (`preloadHelper`, about 0.3 kB gzip) from the plugin's `load` hook. It waits for the stylesheets in the call and ignores scripts. The `modulePreload.resolveDependencies` of the plugin returns no scripts for any chunk, so Vite's dependency tables hold stylesheets only. This replaces the earlier hook that dropped the core from the loader's list.
- The `owners` table of the bundle manifest leaves out a root that is its own owner. `load` reads `owners[id] ?? (bundles[id] && id)`.
- `packages/brumate/test/preload-helper.test.ts`: four tests on a built fixture. The tables hold the stylesheet of a bundle and no script, the helper adds a stylesheet that the page lacks and waits for it, it skips one the page has, and `modulePreload: false` gives the same.
- Patch changeset `.changeset/lean-preload-helper.md`.

## Deviations

- Acceptance 1 says no preload helper "under any name". Vite wraps each `import()` in a call to a helper, and no option removes the wrapper, so the client chunks keep a call `x(() => import(...), [])` and a 427 B (320 B gzip) stub, in place of Vite's 1.5 kB (0.83 kB gzip). Nothing of Vite's helper is left (no `__vite__mapDeps` unless a chunk has a stylesheet, no `modulepreload`, no `preloadOnce`). Removing the wrappers needs a `renderChunk` rewrite of Vite's output, which the brief says to report first.
- No browser test in `e2e/` (not an owned path). The CSS wait is tested in a unit test with a fake document, and I ran a real Chrome check by hand (see Verification).
- Scripts of lazy chunks are no longer preloaded by the helper. `hints.json` covers the loader, the core and the bundles of roots only, so a lazy chunk with its own imports (`rpc`, `navigate`, `defer`) loads them after itself. Their imports are the core, which is loaded already.

## Stubs left

- The `import()` wrappers stay (about 15 B each in the website entry). The loader-preload-spike node can drop them.

## Gotchas

- Vite 8 wraps imports in a native Rust plugin; `/* @vite-ignore */` only stops Rolldown from resolving the specifier.
- The helper module is its own chunk (`preload-helper-*.js`), as before.
- `brumate/test/.output/` is git-ignored and holds the fixture builds.
- A fresh worktree needs `pnpm build` of all packages before `pnpm typecheck` passes (the examples use `brumate-tsc`).
- `vite.test.ts` failed once under load in the fast check and passed on two reruns.

## Proposed learnings

- To change what Vite injects, serve its virtual module from an earlier plugin's `load` instead of rewriting the chunk.

## Verification

- `pnpm lint` (0 errors, warnings as on main), `pnpm format:check`, `pnpm typecheck` pass. `vitest run test/preload-helper.test.ts test/vite.test.ts test/prerender.test.ts`: 35 passed.
- Built todos, dashboard and rows (`pnpm bench --only brumate --metrics dist`): no `__vite__mapDeps` or `modulepreload` in any client chunk.
- Chrome (playwright-core) on a built page with a lazy chunk that imports a stylesheet served 300 ms late: `getComputedStyle` in the chunk's first line is `rgb(255, 0, 0)`, for base `/` and `./`.
- Dev mode is untouched: the `load` hook and the dependency option apply to builds only.
- Not run: the full check and `node e2e/run.mjs`.

## Size

Gzip, main (5b8a1265) against the branch, the machine busy (timings not compared).

| | main | branch |
| --- | ---: | ---: |
| todos, JS before `load` (`pnpm bench --only brumate --scenario todos --metrics dist,browser`) | 36.9 kB / 15.3 kB | 35.3 kB / 14.7 kB |
| todos, client JS in dist | 81.7 kB / 29.0 kB | 79.9 kB / 28.3 kB |
| dashboard, client JS in dist | | 158.6 kB / 38.1 kB |
| rows, client JS in dist | | 79.6 kB / 28.2 kB |
| website entry chunk (`client-*.js` with the loader) | 112,755 B / 28,223 B | 44,781 B / 13,361 B |
| website preload helper chunk | 1,519 B / 827 B | 427 B / 320 B |

The website entry loses 14.9 kB gzip (68 kB raw), 3.8 kB of it from the `owners` table, about the 16 kB the brief expected. The todos gain is 0.6 kB, as expected.
