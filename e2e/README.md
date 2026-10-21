# Smoke tests

These tests build the website and the examples, serve each build, and use it in Chrome. They catch what the unit tests miss because those run in happy-dom, such as a live sample of the docs that renders but does not resume.

```bash
pnpm e2e
```

## Options

- `--only website,todos,nitro` runs only these suites.
- `--no-build` uses the builds that are there. By default it runs `pnpm build`, then the build of each suite.
- `--headed` shows the browser.
- `--install-browser` downloads Playwright's Chromium when no Chrome is found.

## Requirements

- Node 22 or later, and `pnpm install` at the root.
- Chrome or Chromium. The tests look for it where the benchmarks look, in [`benchmarks/harness/chrome.mjs`](../benchmarks/harness/chrome.mjs). Set `CHROME_PATH` to use another one.

## What it checks

Each check is a named step. Any uncaught error, console error or failed request on the page fails the step. A 404 of the favicon is the only error left out.

`website` serves `website/dist/client` with `website/scripts/preview.ts`.

- Each docs page with a live sample loads, and shows as many samples as its markdown has.
- Each sample runs when it is scrolled into view, and shows a result without an error.
- Each button in the result of a sample clicks without an error.
- The counter sample of the state page counts, and its memo follows.
- The validation sample of the forms page shows both field errors for bad input, and the success message for good input.
- The counter demo of the home page counts.
- A link from the home page to the docs and a link in the sidebar navigate without loading a new page. The back button goes back the same way.

`todos` serves the production build of `examples/todos` with a content security policy of `script-src 'nonce-…' 'strict-dynamic'`, and a new nonce for each page.

- The quote streams in after the page.
- Toggling a todo updates the count.
- A todo whose title holds `</script>`, `<!--` and U+2028 is added.
- The state of the layout stays across a route change.
- The counter counts after a navigation, and the todos work after going back.
- Signing the guestbook calls a server function and refreshes the list. An empty name shows the error.
- A link clicked before the core loads navigates, and the page works after it.

`nitro` serves the Node build of `examples/nitro` with `node .output/server/index.mjs`.

- The page resumes, and its counter counts.
- The form calls a server function and the list of notes refreshes, without loading a new page. An empty note shows the error.

## Failures

The summary lists each failed step with its error. The run exits with 1 when a step fails.

A failed step saves a screenshot and the HTML of its page in `e2e/.output/<time>/`. Git ignores that folder.

When a step fails, the later steps of the same flow are skipped, because each needs the one before.

## Adding a check

- To check more on a page, add a step to the suite in `suites/`. A step is `runner.step(suite, name, { page, errors }, check)`, or a step of a flow from `runner.flow(suite, { page, errors })`. `errors` comes from `watch(page)` in `lib.mjs`. Throw, or call `assert`, to fail the step.
- To check another app, add a file in `suites/` that exports `build`, `start` and `run`, and add it to `SUITES` in `run.mjs`.
  - `build` lists the commands that build it, as `[command, args, options]`.
  - `start()` serves the build and returns `{ url, stop }`. `startProcess` in `lib.mjs` runs a server and waits until it answers.
  - `run({ browser, url, runner })` runs the steps.
