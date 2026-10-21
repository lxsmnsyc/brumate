# Benchmarks

This folder compares brumate with Qwik 1, Qwik 2 and Marko 6. Each framework builds the same two pages, and one script builds, serves and measures all of them.

```bash
pnpm install
pnpm bench
```

The command prints a markdown table for each scenario and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results. A full run takes about 4 to 5 minutes on an Apple M2.

## Scenarios

- `todos`: a small page with a todo list and a counter. Every framework ships little code for it.
- `dashboard`: a page with 50 different widgets that are rarely used. It tests the case that lazy loading is for.

`pnpm bench --scenario todos` or `--scenario dashboard` runs one of them. The default runs both.

### Todos

Every app renders the same page:

- A todo list with an input and an Add button. Each item is a button that toggles it done. The list is keyed by ID. Updates make new arrays and objects.
- A `N left` line computed from the list.
- A counter that shows `Clicked N times` and `Double: 2N`.

The server seeds `N` todos, where item `i` is done when `i % 3 === 0`. The page server reads `N` from the `?n=` query parameter, or from the `BENCH_TODOS` environment variable, and defaults to 3. The SSR metrics render 0, 3 and 100 todos.

### Dashboard

The page has a heading, a row of 4 widgets and 46 more widgets stacked below it. Each widget has a fixed height of 480 px, so only the first row and the top of widget 4 are visible in the 1280×720 viewport. The page is more than 20,000 px tall.

Each widget is its own component with:

- A list of 6 numbers, a mode (0 to 2) and an output line as state.
- A summary computed from the list, one of 4 formulas.
- A button that runs a pipeline of 4 steps on the list, writes the new list and formats the result into the output line.
- A "Mode" button that moves to the next mode and writes a preview of 3 other steps with another format.

[`harness/dashboard.mjs`](./harness/dashboard.mjs) generates the widgets. It picks the steps from 17 list operations (sort, filter, dedupe, rotate, running sum, moving average and others) and the format from 12 formatters (currency, percent, Roman numerals, hex, histogram and others). A seeded random generator picks them and their constants, so every build gets the same 50 widgets. Each handler is 16 to 46 lines.

The same handler code goes into every framework. Only the access to state differs: `items` in brumate and Marko, `items.value` in Qwik. The harness runs the same code in Node to know what each click must show.

The generated files are not checked in. The `build:dashboard` script of each app writes them into `dashboard/src/widgets` (`dashboard/src/tags` for Marko), then builds `dashboard/` as a separate Vite project with its own `dist`. The todos build does not see them, so its output does not change. Run `node harness/dashboard.mjs <folder>` to look at the files without a build.

### Folders

| Folder     | Framework                                      |
| ---------- | ---------------------------------------------- |
| `brumate/` | The local `packages/brumate` (`workspace:*`)   |
| `qwik1/`   | `@builder.io/qwik` 1.20.2 with Vite 7.3.7      |
| `qwik2/`   | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4    |
| `marko/`   | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8 |
| `harness/` | The scripts, with `playwright-core` 1.64.1     |

The brumate app uses the workspace package, so a run measures the current code. `pnpm bench` builds `packages/brumate` first.

## What it measures

The todos scenario:

- `browser`: Headless Chrome loads `/?n=3` in a fresh context. It records every same-origin response with the phase in which its request started: before `load`, while idle for 3 s after network idle, and during each interaction. Each interaction waits until the DOM shows the expected result. One session clicks the counter first and the other toggles a todo first, so both first interactions run on a page with no earlier clicks. The total covers the counter click, the toggle and an add.
- `dist`: The size of every `.js` file in the client build output, whether the page loads it or not.
- `ssr-size`: The HTML for 0, 3 and 100 todos. The cost per todo is the difference between 100 and 3 todos divided by 97. The worker also checks that the HTML shows the todos, the `N left` line and the counter.
- `ssr-speed`: Each framework renders in its own process. After 300 warm-up renders per size, the runner asks one framework at a time to render for 1 s and counts the renders. It repeats this for 5 rounds, rotates the order each round, and reports the median with the min and max.
- `waterfall`: Chrome throttles the network to 150 ms of latency and about 1.6 Mbit/s, then clicks the counter. "After idle" throttles after the page loaded and idled. "Cold" throttles from the start and clicks right at `load`. The round trip (RT) count is the longest chain of requests in which each one starts after the previous one finished.

The dashboard scenario:

- `browser`: Three sessions, each on a fresh context with the same 3 s idle wait.
  - The main session clicks the button of widget 1 (above the fold). Then it scrolls widget 30 into view, waits 1 s and clicks its button. Then it does the same with the Mode button of widget 45. The report shows the code fetched on each scroll and each click, and the total.
  - The second session scrolls to widget 30 and clicks it first, so the click on a widget below the fold runs on a page with no earlier clicks.
  - The third session repeats the main one with the idle preload off, for the frameworks that have one. brumate gets the Save-Data flag in the page (`navigator.connection.saveData`), which makes its loader skip the preload, the same check as the plugin's `preload: false`. Qwik renders with `preloader: false`. Marko loads all code at start and has no such option.
- `dist`: The size of every `.js` file in the dashboard client build.
- `ssr-size`: The HTML of the page. The worker checks that it shows every widget.
- `ssr-speed`: As for todos, with the one dashboard page.
- `waterfall`: As for todos, with a click on the button of widget 1.

Sizes show raw and gzip bytes. The harness compresses each file with gzip level 9 itself. The servers send files uncompressed.

## Options

```bash
pnpm bench --help
pnpm bench --scenario dashboard
pnpm bench --only brumate,marko
pnpm bench --skip browser,waterfall
pnpm bench --metrics ssr-size,ssr-speed --no-build
pnpm bench --rounds 9 --duration 2000
```

| Option                | Default | Meaning                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| `--scenario <name>`   | all     | `todos`, `dashboard` or `all`.                          |
| `--only <names>`      | all     | Frameworks to run, by folder name.                      |
| `--skip <metrics>`    | none    | Metrics to leave out.                                   |
| `--metrics <metrics>` | all     | Metrics to run.                                         |
| `--no-build`          | off     | Use the existing `dist` folders.                        |
| `--rounds <n>`        | 5       | SSR throughput rounds.                                  |
| `--duration <ms>`     | 1000    | Length of one SSR throughput round.                     |
| `--idle <ms>`         | 3000    | Idle wait after load in the browser.                    |
| `--latency <ms>`      | 150     | Latency of the throttled waterfall.                     |
| `--install-browser`   | off     | Download Playwright's Chromium when no Chrome is found. |

## Chrome

The browser metrics use `playwright-core` with a Chrome that is already installed. The harness uses `CHROME_PATH` when it is set. Otherwise it looks in the usual install folders on macOS, Linux and Windows. When it finds no Chrome, it prints a message, skips the `browser` and `waterfall` metrics and runs the rest. It downloads a browser only with `--install-browser`.

## Caveats

- Timings depend on the machine. The report records the CPU, the load average at the start and the end, and notes when the machine was busy. Close other work, or compare runs from the same machine only.
- The SSR throughput runs in-process `render` calls, with no HTTP. It measures the renderer, not a server.
- All apps are production builds. Dev servers load different code and are not measured.
- Gzip level 9 runs offline in the harness. A real server may use Brotli or a lower level.
- The servers run on localhost with `cache-control: no-store`. Each browser session starts with an empty cache.
- Qwik preloads code while idle. The "after idle" numbers show that. The "cold" waterfall shows what a click costs before the preload finishes. In the cold run, preload requests that are still in flight count as part of the click.
- The waterfall depth comes from request start and finish times, so it is an estimate.
- The dashboard widgets come from one generator. Their handlers share many lines, so gzip compresses a bundle with all of them better than it would compress 50 handlers written by hand. This favors Marko, which ships them in one file. Each lazy chunk is compressed alone and gets little from gzip.
- brumate preloads the code of every widget in or near the viewport, not only the ones that are clicked. Scrolling far down a page fetches the code of each widget passed on the way that came near the viewport. The harness scrolls straight to a widget, so it skips the ones in between.
- `renderToString` of Qwik 1.20.2 drops the `preloader` option. The Qwik 1 dashboard renders with `renderToStream`, which `renderToString` calls with the same other options.

## Adding a framework

1. Make a folder here, for example `benchmarks/solid/`, with a `package.json` named `bench-<folder>`, exact dependency versions and a `build` script that writes a production build to `dist/`.
2. Build the same app as the other folders. Keep the markup the harness looks for: the counter `<button>` comes right after an `<h2>`, the todo items are `ul li button`, the done class is `done`, and the form has one `input` and one `button`.
3. Add `adapter.js`. It exports a `label` and an async `load()` that returns `{ staticDir, render }`. `staticDir` is the folder with the client files. `render(n)` returns the full HTML of the page with `n` todos.
4. For the dashboard, add a writer for the folder to `harness/dashboard.mjs`, a `build:dashboard` script and a `dashboard/` project. Export `loadDashboard()` from the adapter. It returns `{ staticDir, render, preloadOption }`. `render({ preload })` returns the page, with the idle preload off when `preload` is false. `preloadOption` is false when the framework has no preload to turn off.
5. Run `pnpm install`, then `pnpm bench --only <folder>`.

The harness finds every folder with an `adapter.js`, so no registration is needed.
