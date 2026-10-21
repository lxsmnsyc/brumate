# Benchmarks

This folder compares brumate with Qwik 1, Qwik 2 and Marko 6. Each framework builds the same small app, and one script builds, serves and measures all of them.

```bash
pnpm install
pnpm bench
```

The command prints a markdown table and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results.

## The app

Every app renders the same page:

- A todo list with an input and an Add button. Each item is a button that toggles it done. The list is keyed by ID. Updates make new arrays and objects.
- A `N left` line computed from the list.
- A counter that shows `Clicked N times` and `Double: 2N`.

The server seeds `N` todos, where item `i` is done when `i % 3 === 0`. The page server reads `N` from the `?n=` query parameter, or from the `BENCH_TODOS` environment variable, and defaults to 3. The SSR metrics render 0, 3 and 100 todos.

| Folder     | Framework                                      |
| ---------- | ---------------------------------------------- |
| `brumate/` | The local `packages/brumate` (`workspace:*`)   |
| `qwik1/`   | `@builder.io/qwik` 1.20.2 with Vite 7.3.7      |
| `qwik2/`   | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4    |
| `marko/`   | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8 |
| `harness/` | The scripts, with `playwright-core` 1.64.1     |

The brumate app uses the workspace package, so a run measures the current code. `pnpm bench` builds `packages/brumate` first.

## What it measures

- `browser`: Headless Chrome loads `/?n=3` in a fresh context. It records every same-origin response with the phase in which its request started: before `load`, while idle for 3 s after network idle, and during each interaction. Each interaction waits until the DOM shows the expected result. One session clicks the counter first and the other toggles a todo first, so both first interactions run on a page with no earlier clicks. The total covers the counter click, the toggle and an add.
- `dist`: The size of every `.js` file in the client build output, whether the page loads it or not.
- `ssr-size`: The HTML for 0, 3 and 100 todos. The cost per todo is the difference between 100 and 3 todos divided by 97. The worker also checks that the HTML shows the todos, the `N left` line and the counter.
- `ssr-speed`: Each framework renders in its own process. After 300 warm-up renders per size, the runner asks one framework at a time to render for 1 s and counts the renders. It repeats this for 5 rounds, rotates the order each round, and reports the median with the min and max.
- `waterfall`: Chrome throttles the network to 150 ms of latency and about 1.6 Mbit/s, then clicks the counter. "After idle" throttles after the page loaded and idled. "Cold" throttles from the start and clicks right at `load`. The round trip (RT) count is the longest chain of requests in which each one starts after the previous one finished.

Sizes show raw and gzip bytes. The harness compresses each file with gzip level 9 itself. The servers send files uncompressed.

## Options

```bash
pnpm bench --help
pnpm bench --only brumate,marko
pnpm bench --skip browser,waterfall
pnpm bench --metrics ssr-size,ssr-speed --no-build
pnpm bench --rounds 9 --duration 2000
```

| Option                | Default | Meaning                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
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

## Adding a framework

1. Make a folder here, for example `benchmarks/solid/`, with a `package.json` named `bench-<folder>`, exact dependency versions and a `build` script that writes a production build to `dist/`.
2. Build the same app as the other folders. Keep the markup the harness looks for: the counter `<button>` comes right after an `<h2>`, the todo items are `ul li button`, the done class is `done`, and the form has one `input` and one `button`.
3. Add `adapter.js`. It exports a `label` and an async `load()` that returns `{ staticDir, render }`. `staticDir` is the folder with the client files. `render(n)` returns the full HTML of the page with `n` todos.
4. Run `pnpm install`, then `pnpm bench --only <folder>`.

The harness finds every folder with an `adapter.js`, so no registration is needed.
