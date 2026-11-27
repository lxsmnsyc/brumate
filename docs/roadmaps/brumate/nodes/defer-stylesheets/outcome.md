# Outcome: defer-stylesheets

## Built

- e2e agent (A1): `e2e/run.mjs` reads the browser's user agent once and gives every context and page the same agent without `Headless` (`useBrowserAgent`). A step can pass its own `userAgent`. `headlesschrome` stays on `BOTS`.
- B (option B1): the request for a `#defer` body sends the style of the component that holds the block. `Context.style` remembers the components that the render around the target styled (`aroundStyles`). `deferBlock` asks again for the component of the block, through `child.style`, in the body. The answer then carries the `<style b-style>` or the stylesheet link of the component, as for any component in the body. The cost is the CSS of that component, once per answer.
- C (option C1, changed): the swap of a streamed body (`$bS` in `runtime/server.ts`) waits for the stylesheet links in its `<template b-l>`. It starts a `rel=preload` link for each URL the page does not have, waits for load or error or 4 s (`WAIT` of `sheets.ts`), removes the preloads, then runs the old swap (now `$bX`). A swap with no new link runs at once, so pages without links see no change. Swaps queue behind a waiting one.
- The state records after a waiting swap run after the body is in place: `$bR` pushes to `self.$bQ` while a swap waits, and the swap hands them to `self.$brm` when the queue ends. This is what C1 left out: the records of the answer follow `$bS` in the same response and the core needs the body in the page. `RECORD` grows by 12 bytes per page. The swap script (`SWAP`, inline on every streamed page with a swap) grows from 438 B raw / 304 B gzip to 1327 B / 689 B, about +385 B gzip.
- The tracker gets `/later` (`examples/tracker/src/routes/later.brm`, the repro page): a `#defer ('visible')` body with a block `<style>`, not prerendered, so a crawler and a browser get different pages from it.
- Changeset: patch.

## e2e agent: what failed

- With the agent change alone, `node e2e/run.mjs` passed on every streaming step in all suites except the website overlays focus step, a known load flake (it passed when rerun alone). No new streaming bug showed in the other suites.
- Two steps in the tracker suite cannot tell the agents apart: `/about` and `/team` are prerendered shells, which the server fills the same way for any agent. `/later` is the only page that does, so the crawler step uses it.

## Steps

- "/about: the #defer body waits for its stylesheet before it shows": restored from `a741acca^`, on a second page of the same context (the init script and routes end with the step). The route now adds the link to the filled `<template b-l>`, as the repro did. Fails on base ("the #defer body showed before its stylesheet applied"), passes now.
- "/later: the #defer body comes in a request, with its style, after a link": a browser gets the fallback in the HTML, a link click sends the `x-brumate-defer` request, and the body is red. Fails on base by the repro (`probe.mjs link chrome`, "body shown without its stylesheet"). The suite skips later steps after the first failure, so on base only the `/about` step reports; the repro and the unit test cover B on base.
- "/later: a crawler gets the #defer body in the page, with no request for it": a `HeadlessChrome` agent gets the body, no fallback and no `b-defer`.

## Tests and failure on base

- `packages/brumate/test/resume.test.ts`, "sends the style of a block in the request for its body" (B): fails on base, the answer starts with the body and no `<style>`.
- Same file, "waits for the stylesheets of a body that the response brings before it swaps in" (C): fails on base, the body is in place before the preload loads.
- Fixture `test/render/deferredStyled.brm`, skipped in `test/differential/data.ts` with the other `#defer` pages (only the server renders a `#defer` body).
- 23 snapshots in `test/__snapshots__/render` changed by the `RECORD` text only.
- Repro scripts after the fix (tracker built with the repro pages): `probe.mjs link chrome`, `probe.mjs direct chrome` and `shell-sheet.mjs chrome` exit 0. `probe.mjs direct headless` still shows the body in place, as designed: that agent is a crawler.

## Deviations

- C1 as the outcome of defer-visible-request wrote it ("swaps after each loads") needed the record hold above. The brief's wording "as defer.ts does" is met: same preload, same 4 s.
- The swap now also waits for the stylesheets of `#loading` bodies that link a file the page lacks. The brief marks `#loading` out of scope for the docs promise. The same `$bS` serves both, and a flag would cost more bytes than it saves. Builds inline component CSS, so the cases are the bundle stylesheets of a body.
- A `<link>` inside a nested `<template>` of a body is not waited for (`defer.ts` finds them through `findSheets`). The server does not write one.

## Findings for new nodes

- `$bS` in dev (`SWAP_DEV`) shares the wait; not run in a browser here.
- `#reveal` and `$bF`/`$bH` calls that share a script with a waiting `$bS` run before the body is in place. A fallback shown early by `#reveal (collapsed)` can flash. Not seen in a test; a node could move them after the wait.
- The answer of a request for a `#defer` body brings the whole CSS of the component that holds the block, even when the page has it. A smaller answer would carry only the rules with the block scope; the compiler knows them.
- The head of the page keeps a `style[b-style]` of the component for a direct load, and the answer repeats it. It is deduped by nothing on the client; harmless, but the body style stays in the page after a later navigation (`pruneSheets` reads only the head).

## Gotchas

- A test that waits on a swap needs a `link` href that happy-dom would fetch; the unit test logs a refused fetch for `/slow.css` and passes.
- `pnpm build` of the tracker rewrites `examples/tracker/src/brumate-routes.d.ts` when a route is added; the file is committed.
- `vitest -t "#defer"` on `resume.test.ts` fails "puts the body in place of the fallback when its trigger fires" on base too (isolation), and passes in the whole file and alone.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass (lint warnings only, none new).
- Root `pnpm test`: pass (130 files, 3783 tests in `packages/brumate`).
- `node e2e/run.mjs` (full): all suites pass except website, which had one failure in the full run, "a visit that a newer one replaced does not swap or leave" (a step before it took 407 s, so the machine stalled). Rerun alone, that step passed; only the known overlays focus flake failed. tracker: 21 passed.

## Size

- Estimated M, actual M. Risk medium: the swap script and the record function are in every streamed page.

## Review rework

- B walks up from the scope of the block to the nearest scope with a module, so a `#defer` inside `#if` or `#for` (two items too) gets its style. Fixtures `deferredStyledIf` and `deferredStyledFor`; the test fails on base.
- `$bS(id, then)`: the `#reveal` fallback calls and the head call run in `then`, after the body is in place, also when the swap waits. Their function definitions stay at the top level of the script. Test "applies the head of the body after the body" fails on base.
- A throw in the waited swap is caught and logged with `console.error`; the queue count and held records are released and the next swap runs at once. Test "keeps swapping when a swap that waited throws" fails on base.
- The 4 s timer starts when `$bS` is called, not on the turn of the swap, so queued swaps share the time and the wait is at most about 4 s.
- `website/docs/styles.md` now names `#loading` bodies too.
