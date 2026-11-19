# style-files: first contentful paint

Question: does moving component CSS from inline `<style>` to linked `.css` files change FCP?

## Setup

- Base: `f5cd683b` (release/0.9 before style-files). Head: `c401cfb7` (origin/feat/style-files, head links and navigation waits).
- Harness: `benchmarks/navigation/run.mjs` from `bench/navigation-fcp` (`--first-load --gzip --network --cpu`), copied into a scratch worktree of each build. Server mode of the website: pages rendered by `route`, `/assets` with an immutable cache, HTML and assets gzipped.
- Chrome 157.0.8103.79 headless (Playwright), 8 CPUs, macOS.
- Profiles, from DevTools `core/sdk/NetworkManager.ts` (read 2026-11-19), applied with `Network.emulateNetworkConditions`: Slow 4G is 1.6 Mbps down and 750 Kbps up at 90%, round trip 150 ms times 3.75 (562.5 ms); Fast 4G is 9 Mbps down and 1.5 Mbps up at 90%, round trip 60 ms times 2.75 (165 ms). CPU is `Emulation.setCPUThrottlingRate` 4 on both throttled profiles.
- Runs: 20 per build and profile, taken as 4 batches of 5 that alternate base and head (ABAB), so a drift of the machine reaches both. Each batch starts after a load average (1 min) of 4 or less. A cold load uses a new browser context (empty cache). A warm load is the second visit in the same context, with the cache kept. One uncounted load of each page warms the server first.
- Load average (1 min) during the runs: median 3.7 (slow4g), 4.5 (fast4g), 3.8 (off); the machine is shared and some runs saw a load of 9 to 10 (slow4g batch 1, head, and the fast4g batches). Other users load this machine, so absolute times are only comparable inside a table.
- Verdict rule: the difference of the medians must be larger than the IQR of both builds and larger than half of the widest min-max range. Otherwise "within noise".
- Not measured: the static host (`docs-static`, the repo's preview script sends no cache or compression headers).
- One slow4g head batch failed once on a 30 s `goto` timeout in the harness and was run again after the timeout was raised to 120 s.

## Where the stylesheets sit

|                                         | base                                                                                                                                                               | head                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `/` head                                | `<style>` 25 KB (root block) at child 6, a second `<style>` 1.6 KB at 7, 47 `modulepreload` links, title. The rest of the CSS (about 20 KB) is inline in the body. | `<style>` 25 KB at 6, 47 `modulepreload` links, then 3 `<link rel=stylesheet>` right before `<title>` |
| `/docs/components/` head                | same, 51 `modulepreload` links                                                                                                                                     | same, 51 `modulepreload` links, then 4 stylesheet links before `<title>`                              |
| render-blocking CSS requests            | 0                                                                                                                                                                  | 3 on `/`, 4 on `/docs/components/`                                                                    |
| CSS bytes (inline plus linked, decoded) | 46.8 KB, 41.6 KB                                                                                                                                                   | 46.6 KB, 43.7 KB                                                                                      |
| CSS transfer (linked, gzip)             | 0                                                                                                                                                                  | 6.2 KB on both pages                                                                                  |
| HTML transfer (gzip)                    | 20.7 KB, 34.3 KB                                                                                                                                                   | 16.4 KB, 31.4 KB                                                                                      |

The head still inlines the 25 KB root block, so only the component CSS moved. The linked files are discovered in the HTML after the 47 to 51 preload links and are fetched only after the HTML arrives, so each page pays one extra request round trip before the first paint. On a warm load the files come from the cache and the blocking count stays (3 and 4) but costs nothing.

## slow4g + cpu 4 (all times in ms: median [min-max, IQR], n=20)

| page or pair                           | base median         | head median          | delta | verdict                              |
| -------------------------------------- | ------------------- | -------------------- | ----- | ------------------------------------ |
| `/` first load FCP                     | 692 [660-1008, 52]  | 1928 [1908-2152, 16] | +1236 | head slower                          |
| `/` first load LCP                     | 772 [732-1008, 84]  | 1928 [1908-2152, 16] | +1156 | head slower                          |
| `/` warm FCP                           | 688 [664-796, 36]   | 696 [668-764, 20]    | +8    | within noise                         |
| `/docs/components/` first load FCP     | 692 [664-1564, 44]  | 1952 [1932-2108, 16] | +1260 | head slower                          |
| `/docs/components/` first load LCP     | 792 [736-1564, 116] | 1952 [1932-2108, 16] | +1160 | head slower                          |
| `/docs/components/` warm FCP           | 704 [684-808, 24]   | 708 [688-772, 12]    | +4    | within noise                         |
| `/docs/styles` to `/docs/context` swap | 816 [803-932, 11]   | 810 [791-974, 17]    | -6    | within noise                         |
| `/ui/button` to `/ui/dialog` swap      | 895 [881-1143, 12]  | 855 [838-893, 14]    | -40   | within noise by the rule (see below) |

## fast4g + cpu 4

| page or pair                       | base median        | head median       | delta | verdict      |
| ---------------------------------- | ------------------ | ----------------- | ----- | ------------ |
| `/` first load FCP                 | 344 [248-620, 108] | 676 [656-788, 24] | +332  | head slower  |
| `/` first load LCP                 | 364 [340-620, 40]  | 676 [656-788, 24] | +312  | head slower  |
| `/` warm FCP                       | 288 [272-636, 16]  | 284 [260-288, 20] | -4    | within noise |
| `/docs/components/` first load FCP | 336 [260-472, 44]  | 676 [660-716, 20] | +340  | head slower  |
| `/docs/components/` first load LCP | 336 [316-668, 40]  | 676 [660-716, 20] | +340  | head slower  |
| `/docs/components/` warm FCP       | 304 [292-480, 24]  | 308 [292-372, 16] | +4    | within noise |
| docs swap                          | 293 [262-730, 50]  | 266 [255-413, 10] | -27   | within noise |
| ui swap                            | 320 [286-464, 54]  | 303 [283-359, 13] | -17   | within noise |

## unthrottled

| page or pair                       | base median     | head median     | delta | verdict      |
| ---------------------------------- | --------------- | --------------- | ----- | ------------ |
| `/` first load FCP                 | 72 [60-92, 12]  | 72 [68-96, 4]   | 0     | within noise |
| `/` warm FCP                       | 44 [36-64, 4]   | 48 [36-64, 8]   | +4    | within noise |
| `/docs/components/` first load FCP | 72 [68-136, 12] | 76 [68-100, 12] | +4    | within noise |
| `/docs/components/` warm FCP       | 48 [44-56, 8]   | 44 [40-64, 4]   | -4    | within noise |
| docs swap                          | 50 [40-78, 26]  | 69 [40-76, 27]  | +19   | within noise |
| ui swap                            | 68 [56-281, 18] | 58 [42-79, 10]  | -10   | within noise |

Paint timestamps have a resolution of 4 ms here, so deltas of 4 ms are one tick.

## Conclusion

- Yes, style-files makes first-load FCP and LCP worse on a throttled network: +1.2 s on Slow 4G (692 to 1928 ms on `/`, 692 to 1952 ms on `/docs/components/`) and +0.33 s on Fast 4G (about 340 to 676 ms). The delta is about two throttled round trips (562 ms times 2 and 165 ms times 2), in line with one extra blocking request after the HTML. The head spread is small (IQR 12 to 24 ms), so the effect is far outside the noise.
- Unthrottled (localhost) the difference is within noise (0 to +4 ms), because a round trip costs almost nothing there.
- Warm loads do not improve: the cache serves the files, but base already paints at the same time from inline CSS (within noise on every profile). Gzip makes the HTML 3 to 4 KB smaller on head, which does not offset the extra request.
- Navigation swap time is within noise on every profile except possibly `/ui/button` to `/ui/dialog` on Slow 4G, where head is 40 ms faster (4%) and the two distributions barely overlap; one pair on one profile, so I would not claim it.
- The cost comes from the stylesheets sitting after 47 to 51 preload links and being fetched only after the HTML. A hint earlier in the head (a `preload` of the CSS before the module preloads, or an HTTP `Link` header / 103 Early Hints) or inlining the CSS of the first route are the candidates to test; not measured here.
