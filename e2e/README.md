# Smoke tests

These tests build the website and the examples, serve each build, and use it in Chrome. They catch what the unit tests miss because those run in happy-dom, such as a live sample of the docs that renders but does not resume.

```bash
pnpm e2e
```

## Options

- `--only website,todos,tracker,nitro,kit,ui,browser-async,scripts,transitions` runs only these suites.
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
- The shop demo of the home page adds to the cart.
- A link from the home page to the docs and a link in the sidebar navigate without loading a new page. The back button goes back the same way.

`todos` serves the production build of `examples/todos` with a content security policy of `script-src 'nonce-…' 'strict-dynamic'; require-trusted-types-for 'script'; trusted-types brumate`, and a new nonce for each page.

- The quote streams in after the page.
- Toggling a todo updates the count.
- A todo whose title holds `</script>`, `<!--` and U+2028 is added.
- The state of the layout stays across a route change.
- The counter counts after a navigation, and the todos work after going back.
- Signing the guestbook calls a server function and refreshes the list. An empty name shows the error.
- A link clicked before the core loads navigates, and the page works after it.

`tracker` serves the Nitro build of `examples/tracker` with `serveNitro`: `node .output/server/index.mjs` behind a proxy that adds `require-trusted-types-for 'script'; trusted-types brumate` to each page. It checks Trusted Types only, since the script tag that brumate writes has no nonce. The story node `script-nonce` restores the nonce checks. The build prerenders `/about`, `/from`, `/team` and the pages of `/titles`. `/from` and `/titles` are files in `.output/public`. `/about` and `/team` have a `#defer` block, so they are written to the server assets, and the routes send them as the `shell`.

- The list renders, and the activity feed streams in.
- The search and the status filter the list.
- A star shows before the server answers, while the call is held back, and stays after it.
- A link after the star sends no server function calls.
- `/issues/new` sends a visitor who is not signed in to the sign-in page, through the middleware.
- Signing in with a short name shows an error. Signing in goes back to `/issues/new` without a full page load.
- A short title shows its error, then a valid issue opens on its page without a full page load.
- Closing an issue shows before the server answers.
- Delete opens a dialog that takes the focus. Esc closes it, and confirming deletes the issue.
- A related issue that is gone shows the `#catch` of its `#try`.
- Links and the back button load pages without a full page load, and `/about` opens from a link and directly.
- The `#defer` line of `/about` renders on the server for the user who signed in, after a link and directly.
- `/from` and the pages of `/titles` are served as files, with an etag and a length. `/about` and `/team` are sent as shells.
- No page is wider than 320 px on a phone.
- Without scripts, signing in works, and a short title shows its error with the title kept.

`nitro` serves the Node build of `examples/nitro` with `node .output/server/index.mjs`.

- The page resumes, and its counter counts.
- The form calls a server function and the list of notes refreshes, without loading a new page. An empty note shows the error.

`kit` serves the Nitro build of `examples/kit-app` with `serveNitro`, under Trusted Types only (`script-nonce` restores the nonce checks). Its page renders the components of `examples/ui-kit`, a package of components.

- The components of the package render, with their scoped styles.
- A handler of a package component resumes, and a memo of its module follows.
- A prop that the app changes updates the package component.
- A server function of the package answers.
- The app calls a module of reactive logic of the package.

`ui` serves the Nitro build of `examples/ui`, a page of every part of `@brumate/ui`, with `serveNitro`, under Trusted Types only (`script-nonce` restores the nonce checks).

- `VisuallyHidden`: the link that skips to the content takes no space until Tab reaches it, then shows, and a button with a hidden name has that name for screen readers.
- axe-core finds no violations on the page.

`browser-async` serves the Nitro build of `examples/browser-async` with `serveNitro`, under Trusted Types only (`script-nonce` restores the nonce checks). Each block opens in the browser, and the test settles its promises from the page, so no step waits on a timer.

- `#if` branch and `#for` rows: a `#loading` fallback, an awaited memo and a promise in text, rows settling out of order.
- Root boundary: a block outside every `#loading` keeps the old content until its memo settles.
- `#loading (memo)`: the fallback shows again, and the same nodes and input value come back.
- `#try`: a rejected wait shows the `#catch`.

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

`scripts` serves the production build of `examples/external-scripts` under the same policy, and answers the files of `https://third-party.test` itself.

- A script of `#head` without a trigger is a `<script>` with the nonce, and the others are `<template b-script>`.
- `idle` asks for its file after `DOMContentLoaded`. `interaction` waits for a key. `visible` waits until the element after it is in view.
- An inline script runs once, under the nonce and Trusted Types, with its code as written, also in a block that the browser opens.
- Two blocks with the same `src` request it once.
- A client navigation keeps the scripts, requests only the new files, and runs a `data-rerun` script again.

`transitions` serves the production build of `examples/view-transitions` under the same policy and reads the animations of the pseudo-elements that the browser makes.

- No element has a `view-transition-name` at rest, and none after a transition, also with `prefers-reduced-motion`.
- A list that `transition()` reverses has a group for each item, one that is added has only a new image, one that is removed has only an old one, and an element out of view is not named.
- A handler without `transition()` starts none, and with `prefers-reduced-motion` a handler starts none.
- A client navigation pairs the two elements of one `viewTransitionName`.
- In a browser without `startViewTransition`, the handler and the navigation run as before.
