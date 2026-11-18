# Log: style-files-spike

## Baseline (before the prototype)

- Base commit: `d713634e` (`batch/brumate-release-0.9`, equal to `release/0.9`). Prototype branch: `spike/style-files`.
- Build: `pnpm build` (packages), then `cd website && pnpm build` (client build, then server build; the site is prerendered to `website/dist/client`).
- Measure script (not committed): serves `website/dist/client` with a static server, `cache-control: immutable` on `/assets/*` and `no-cache` on HTML, drives Chrome with playwright-core, and counts the bytes the server sends per view (gzip -9 computed per HTML, JS and CSS body). View 1 is `/`, view 2 is `/docs/components/` in the same browser context, so assets cached by view 1 are not sent again.
- Bench: `pnpm bench --only brumate --scenario todos`, run alone. A first run was thrown away: it built packages/brumate with prototype edits already in the tree. The second run is from a clean tree at `d713634e`.

| Metric (base, d713634e)                          | Value                                       |
| ------------------------------------------------ | ------------------------------------------- |
| View 1 `/`: requests                             | 53                                          |
| View 1 HTML raw / gzip                           | 95,858 / 20,418                             |
| View 1 JS raw / gzip (48 files)                  | 213,975 / 84,320                            |
| View 1 CSS                                       | 0 (12 inline `<style b-style>` in the HTML) |
| View 1 HTML+JS+CSS gzip                          | 104,738                                     |
| View 2 `/docs/components/` (warm): requests      | 9                                           |
| View 2 HTML raw / gzip                           | 210,150 / 33,953                            |
| View 2 JS raw / gzip (5 new files)               | 163,979 / 50,690                            |
| View 2 HTML+JS+CSS gzip                          | 84,643                                      |
| Two views in a row, gzip                         | 189,381                                     |
| View 1 of `/docs/components/` cold: HTML+JS gzip | 33,953 + 131,966 = 165,919                  |
| todos: JS before `load`                          | 5 files, 33.2 kB raw / 13.8 kB gzip         |
| todos: client JS emitted                         | 8 files, 84.9 kB / 29.9 kB                  |

## Prototype

- Started from `d713634e`. The prototype is one commit on `spike/style-files`, tip `078616fe`. Never merged.
- Design built: per component. In a build (`hideNames`), `compileStyles` output goes through `preprocessCSS` (Vite's CSS pipeline) in a new `styleAsset(file)` in `vite.ts`, then `minifyCSS`. The asset is named `assets/<path>/<Name>-<hash>.css` from its content hash, so the client and the server build agree on the URL. The client build emits an asset for every component that has CSS, including components with no client code. The render and server modules import `./X.brm?brumate-style`, whose default export is the URL, and call `style(id, url, true)`. The server writes `<link rel="stylesheet" b-style>` at the first instance, where it wrote `<style>`. The browser's `addStyle` adds a `<link>`. Dev is unchanged.
- First attempt, `X.brm?url&brumate-style&lang.css` (Vite's `?url` on a CSS id), failed in the build: Vite did not run our `load` output through its CSS plugin, and rolldown parsed the CSS as JavaScript. Replaced by the hash-named asset above.
- Navigation: `preloadStyles(next)` in `runtime/navigate.ts` adds `<link rel=preload as=style>` for the new page's stylesheets and waits for them before the swap. `keepStyles` and `replaceRoutes` match `[b-style]`, so links go with their route.
- Build of the website: `cd website && pnpm build`, clean.

### Measurements on the prototype (`078616fe`)

Same script as the baseline. Gzip is `gzip -9` of each HTML, JS and CSS body.

| Metric                                     |    Base | Per component (built) | Per route + shared (simulated) | One per route (simulated) |
| ------------------------------------------ | ------: | --------------------: | -----------------------------: | ------------------------: |
| View 1 `/`: requests                       |      53 |                    65 |                             55 |                        54 |
| View 1 HTML gzip                           |  20,418 |                16,218 |                         16,013 |                    16,003 |
| View 1 CSS gzip                            |  inline |      7,641 (12 files) |                5,184 (2 files) |            4,582 (1 file) |
| View 1 HTML+JS+CSS gzip                    | 104,738 |               108,160 |                        105,498 |                   104,886 |
| View 2 `/docs/components/` warm: requests  |       9 |                    13 |                             10 |                        10 |
| View 2 CSS gzip                            |  inline |   2,737 (4 new files) |                 1,909 (1 file) |            3,406 (1 file) |
| View 2 HTML+JS+CSS gzip                    |  84,643 |                84,561 |                         83,587 |                    85,075 |
| Two views in a row, gzip                   | 189,381 |      192,721 (+3,340) |                 189,085 (-296) |            189,961 (+580) |
| `/docs/components/` cold: HTML+JS+CSS gzip | 165,919 |               168,529 |                   not measured |              not measured |

- The two simulated columns are built from the real processed CSS files of the prototype: the `<link>` run of each of the two pages is replaced by one concatenated file (one per route), or by a shared file (the 5 components both pages use: Layout, Header, BrandMark, Search, Icon) plus one file per route. Vite was not asked to produce them.
- Inline CSS of the two pages costs about 7.0 kB gzip in the HTML (HTML gzip of base minus prototype, both pages).
- todos bench (`pnpm bench --only brumate --scenario todos`, base `d713634e` and prototype `078616fe`): JS before `load` 5 files, 33.2 kB / 13.8 kB in both; client JS emitted 8 files, 84.9 kB / 29.9 kB in both; SSR HTML 3 todos 730 B and 722 B gzip, 0 todos 596 B and 592 B. The todos app has no component CSS in its JS, so the JS is unchanged.
- Both bench runs report a busy machine (load average 10 or more at the start) and so noisy timings; sizes are exact.

### Checks

- Website build: no inline `<style b-style>` in `/` and `/docs/components/` HTML; the only `<style>` left is the highlighter theme variables. `$$css` is in no component chunk. It is in `run-*.js`, the in-browser compiler of the REPL, which compiles in dev mode.
- `pnpm --filter brumate test`: 6 files failed, 7 tests. Two are the style tests that assert `const $$css = "…"` in build output (`test/styles.test.ts` "leaves out comments and whitespace in a build", `test/styles/block-styles.test.ts` "marks only the elements that a selector of the block could match in a build"): a small fix, they read the asset or the import instead. The other five (`render.test.ts` hook timeout, `devtools.test.ts` x3, `differential-3.test.ts`, `stores.test.ts`) passed on a second run of those four files (267 tests), so they are timeouts under load.
- Client navigation, real Chrome (playwright-core, `/Applications/Google Chrome.app`), `/` to `/docs/getting-started` by clicking a link, with a probe that counts, on every animation frame, the stylesheet links with no `sheet`. CSS responses delayed by 400 ms: 92 frames after the navigation, 0 with a pending sheet. Control with the preload wait turned off: 24 of 92 frames had a pending sheet, so the probe sees the problem. With no delay: 0. The page was a client navigation (a marker on `window` survived).
- PostCSS probe (`preprocessCSS` with an inline PostCSS plugin and a Lightning CSS target, run in a script outside the repo): with the default transformer the PostCSS plugin ran. With `css.transformer: 'lightningcss'`, nesting, `width >=` media ranges and `inset` were lowered for the target, but the PostCSS plugin did not run. The child that wires the pipeline must check this on a real build.
