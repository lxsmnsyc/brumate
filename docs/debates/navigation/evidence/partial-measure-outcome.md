# Outcome: partial-measure

## Built

`benchmarks/navigation/` has the harness. `node benchmarks/navigation/run.mjs` loads a built app in Chrome, clicks one link between two pages that share layouts, and prints for each pair:

- the response of the navigation: raw and gzip bytes, and the bytes of the route regions that change;
- the milliseconds from the click to the end of the swap (median, p90, min, max), split into the wait for the first byte and the read, parse and swap after it;
- the JS of the first load and of the first navigation (cold cache, one extra run).

Files: `run.mjs` (CLI, browser, numbers), `regions.mjs` (finds the regions in a response by the `<!--R...-->` comments and pairs them as `plan` does), `serve.mjs` (the two servers).

Flags: `--pairs`, `--runs` (20), `--check`, `--expect full|partial` (default `full`), `--input script|mouse`, `--build`, `--no-build`, `--json FILE`. A missing `dist` is built; `--build` rebuilds the packages and the apps.

How each number is measured:

- Raw bytes: the UTF-8 length of the response body that Playwright reads for the `fetch` that has the `x-brumate-base` header. `--check` asserts it equals `decodedBodySize` of Resource Timing.
- Gzip bytes: `zlib` level 9 of that body in Node. Neither server compresses, so `encodedBodySize` equals the raw size, and `transferSize` adds about 300 B of headers.
- Changing regions: the HTML from `<!--R...-->` to its `<!--/R-->` of each slot that `plan` would replace, found in the response of the new page against the response of the old one (same key and children means kept). Raw and gzip of those pieces joined. The state record, the head entries and the closing markup are outside the regions and a partial response would still need part of them, so this is the lower bound of a partial response and `full - regions` is the ceiling of what it can save.
- Time to swap: the page records `performance.now()` in a capture click listener, and again when `history.pushState` is called, which `navigate` calls right after `replaceRoutes` in the same task. Wait: click to `responseStart` of the fetch (Resource Timing). Read: `responseStart` to the swap. `frame` (in the JSON) is the time to the next animation frame.
- Layouts kept: the harness marks an element of a layout before the click and reads the mark after, so `swap: routes` means the layout nodes survived and `body` means the whole body was replaced.
- JS: every response with a JavaScript content type in a fresh browser context, before the click (first load) and after it (first navigation, until the network is idle plus 500 ms). `.wasm` files are left out.
- Partial or full: the response header `x-brumate-partial: 1`. Today no response has it, so `--expect full` passes and `--expect partial` fails.

## Deviations

- `benchmarks/navigation/run.mjs` imports `playwright-core` from `e2e/package.json` with `createRequire` and reuses `findChrome` and the process helpers of `e2e/lib.mjs`. It has no `package.json`, so `pnpm-lock.yaml` did not change.
- The brief says to serve the output with the repo's static preview. The preview cannot answer in part (it ignores the request header), so the harness also serves the website with its server build (`server` mode). Both are measured. Only `server` can show a partial response.
- The brief names `@sidebar`. The website has no such slot, so the deeper pair is `/about` to `/team` of examples/tracker (a root layout and an `@aside` slot), server mode only. Its pages are tiny, so its bytes say little.
- `--check` asserts the swap replaced the routes in both modes (see Gotchas), not only that the response is full or partial.
- `--check` runs one run of `docs-static` and `docs-server` and builds when a `dist` is missing.

## Gotchas

- The website is a static deployment. A navigation there gets the prerendered page, never a partial one. The story only helps a deployment with a server, unless the static build also writes partial files.
- A static page has no `b-root`. The client calls `shiftFor` and moves the IDs of the page, and then `planRoutes` still replaces only the routes. So even today a static navigation keeps the layouts. The `read` time of the static pairs is longer than the server pairs, which may include that shift (not isolated).
- A real click prefetches. Focus on mousedown or a hover of 80 ms calls `prefetch`, and the click reuses the response. The default `--input script` avoids it. With `--input mouse` the wait did not drop in the runs below (28 to 35 ms), so no prefetch was used there, but a person who hovers first may get one.
- The state record is outside the regions and is large: in `/docs/context` it is 72.6 KB raw and 10.9 KB gzip of the 193.8 KB. The head is 34.4 KB raw and 8.2 KB gzip. A partial response still carries the state of the new route and its head entries.
- The first load of a docs page fetches 362.7 KB gzip of JS (54 files under `/assets`), 209 KB of it the live sample runner `run-*.js`, and the WebAssembly parser and transformer (about 1.4 MB gzip, not counted). The HTML of a navigation is small next to that, but that JS loads once.
- The first navigation loads `navigate-*.js` and `client-routes-*.js` (5.1 KB gzip) in every pair, since the navigation code is not part of the first load. The UI pair adds 16.7 KB gzip of chunks of the new page (demos, Popover). The extra 2.2 KB of the docs pair are modules that the live samples make at run time (`/<uuid>` URLs).
- `performance.getEntriesByType('resource')` lists the fetch only after its response ends, so the read time never includes a response that is still streaming.
- Swap time includes `visit.leave` and the callback of a view transition if the page has one.

## Verification

- `node benchmarks/navigation/run.mjs --check --no-build` prints the table and exits 0 (`ok docs-static`, `ok docs-server`).
- `node benchmarks/navigation/run.mjs --check --no-build --expect partial --pairs docs-server` fails with `the response is full, expected partial`.
- `pnpm lint` and `pnpm format:check` pass.
- Not run: `pnpm bench`, `pnpm test`, `pnpm e2e` (no source outside `benchmarks/navigation` changed).

## Baseline

- Commit: d713634e (`origin/feat/partial-route-responses`, equal to release/0.9), built from this tree with `pnpm build` and `pnpm --filter website build`, `pnpm --filter example-tracker build`.
- Browser: Chrome 157.0.8103.79, headless, macOS, 8 CPUs, 8 GB, CPU throttle off, no network throttle, Node 26.12.1.
- 20 measured runs for each pair after one discarded run, the pairs taking turns in each round. A fresh load of the first page for every run, the click by `link.click()`.
- Load average (1 minute) while the runs went: run A median 19.7, p90 22.0 to 22.3; run B median 21.3, p90 24.9; run C (mouse) median 15.3, p90 16.0. The machine had other workers on it the whole time.

Bytes (exact; the three runs differ by at most 11 B, from IDs and nonces):

| pair                                          | response | raw B  | gzip B | regions raw B | regions gzip B | regions share raw / gzip |
| --------------------------------------------- | -------- | ------ | ------ | ------------- | -------------- | ------------------------ |
| docs-static `/docs/styles` to `/docs/context` | full     | 193791 | 33232  | 65923         | 10466          | 34% / 31%                |
| docs-server (same pages)                      | full     | 192164 | 32477  | 66284         | 10484          | 34% / 32%                |
| ui-static `/ui/button` to `/ui/dialog`        | full     | 323919 | 43238  | 111657        | 12673          | 34% / 29%                |
| ui-server (same pages)                        | full     | 321042 | 42432  | 111729        | 12692          | 35% / 30%                |
| tracker-server `/about` to `/team`            | full     | 3155   | 1531   | 354           | 256            | 11% / 17%                |

Each response has one replaced region in the docs and ui pairs (the page route), and two in the tracker (the page and the `@aside` slot, whose same key does not count as kept because it has no child slots). The target of the story, a response of at most 50% of the full bytes, sits above these regions by the head and the state record; the ceiling of the saving is 66% raw and 68% gzip for docs, and 65% and 70% for ui.

Time from click to the end of the swap, in ms (median / p90), and the load of the run:

| pair           | run A         | run B         | run C (mouse) |
| -------------- | ------------- | ------------- | ------------- |
| docs-static    | 79.8 / 103.7  | 69.4 / 120.0  | 70.6 / 81.8   |
| docs-server    | 71.0 / 121.8  | 60.7 / 213.5  | 72.0 / 78.7   |
| ui-static      | 78.9 / 112.6  | 83.3 / 134.9  | not run       |
| ui-server      | 125.0 / 169.7 | 108.3 / 290.1 | not run       |
| tracker-server | 19.5 / 30.5   | 18.0 / 43.3   | not run       |
| load median    | 19.7          | 21.3          | 15.3          |

Split of the median, run A, in ms (wait for the first byte + read, parse and swap): docs-static 13.5 + 67.0, docs-server 32.2 + 38.7, ui-static 12.0 + 62.0, ui-server 46.4 + 62.3, tracker-server 11.7 + 5.8. In the server mode the wait holds the server render. The run with the mouse had a median wait of 34.9 (docs-server) and 28.2 (docs-static).

JS, cold cache (gzip):

| pair    | first load         | first navigation                         |
| ------- | ------------------ | ---------------------------------------- |
| docs    | 56 files, 362.7 KB | 11 files, 7.3 KB (2 built files, 5.1 KB) |
| ui      | 62 files, 141.9 KB | 12 files, 21.8 KB                        |
| tracker | 4 files, 21.6 KB   | 3 files, 5.4 KB                          |

How far to trust the timings: the load average was 15 to 28 on 8 CPUs. Medians of the same pair differ by 10 to 15% between runs A and B (docs-server 71.0 and 60.7, ui-server 125.0 and 108.3), and the p90 differs by up to 75% (121.8 and 213.5), with maxima up to 569 ms. Trust a median to about 20%, and do not use the p90 or the max. The one run at lower load (C) had a p90 within 10% of its median, so a quiet machine would be much tighter. A change of under 25% or 15 ms on the median is not visible in this data. Compare before and after in one session, with the pairs interleaved as the harness does, and read the load column. Byte counts do not depend on load.
