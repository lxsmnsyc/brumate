# Outcome: style-files-navigation

## Built

- `runtime/sheets.ts` (new, shared by `navigate.ts` and `defer.ts`): `preloadSheets(root, signal)` adds a `<link rel=preload as=style>` (with the link's nonce) for each stylesheet of a tree of markup, also inside `<template>` content, that the page does not have, and waits for each to load or fail. It stops waiting after 4 s (long enough for a slow network, short enough that a stalled file does not hold the page; the swap then goes on like the error path) or when the visit's signal aborts. It also holds the helpers that match links by resolved `href` and read the scopes (`b-c-<hash>`) of a loaded sheet.
- `navigate.ts`: `preloadSheets(next, current.signal)` runs before `visit.leave`; a visit that was replaced meanwhile stops before it leaves. `updateHead` identifies a stylesheet link by `href`, so a CSP nonce does not make a link new on every navigation.
- Stale CSS: on a route replacement, `copySheets` puts a copy of each old route link whose URL the page lacks in the head before the old nodes go (a direct link of the route stays until its copy loads, so the CSS is never missing for a frame), and `pruneSheets` removes head links whose scopes no element uses. A link stays when it has no scopes (global), is not loaded or cannot be read, is a `b-bundle` link, or a bundle of the page names its file (`b-load`), because a component that the browser renders later may need it.
- `defer.ts`: the body of a `#defer` block waits for its `<link>` elements (`preloadSheets`) before it is appended, so it does not show unstyled.
- `runtime/bundles.ts`: a stylesheet link the loader adds is a promise in `pending`, so `load(id)` waits for it.
- e2e: website suite (a navigation with the CSS delayed 400 ms has every sheet applied at the swap and requests each URL once; a stylesheet that answers after 6 s does not hold the navigation more than 4 s; a replaced visit does not swap or tear down the page; head sheets that no element uses are gone after route replacements); tracker suite (a `#defer` body with a slow stylesheet shows only after it applied).

## Proof

- base (`feat/style-files`, preload call disabled): the test sees DocsShell and LiveSample CSS pending when `.docs .sidebar` enters the document (141 ms; applied at 562 ms).
- branch: the swap waits (about 550 ms), all links applied; 0 pending.

## Deviations

- None. `addStyle` takes no URL: in a styleFiles build the browser code calls no `addStyle` (style-files-links), so nothing needed it.
- The "unstyled frames" count of the spike (rAF sampling) does not work: a pending head stylesheet blocks rendering and holds rAF. The test checks at the DOM mutation instead.

## Stubs left

- None.

## Gotchas

- A stylesheet already linked in the page that has not finished loading counts as present: navigation does not wait for it, and the loader does not either.
- A link nested inside an old route element (not a direct node of the route) goes with it at once, without waiting for its copy.
- The prune reads the CSS rules, so it needs a same-origin sheet or one served with CORS; others stay.

## Proposed learnings

- Test render-blocking by checking at the DOM mutation, not by sampling frames | a blocked render holds `requestAnimationFrame` | e2e/suites | no

## Verification

- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm build && pnpm test && node e2e/run.mjs`: pass (unit 3270 in brumate; e2e website 76, todos 10, tracker 17, nitro 2, kit 5, ui 61, browser-async 6). An earlier website run timed out once in "no scrollable region" (254 s, 159 s alone) under load from the other workers; load noise.
- Fix round 1: see the log. `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 33.2 kB / 13.9 kB gzip (release/0.9: 13.8 kB; machine load 8.7, +0.1 kB is within rounding of the bench).

## Size

- Estimated M, actual M.

## Review notes

- Two new e2e steps were shown to fail on the pre-fix runtime (stylesheet that never answers; `#defer` body before its stylesheet). The overtaken-visit and head-prune steps were skipped in that run and are not proven to discriminate.
- `pruneSheets` reads each sheet's `cssText` once (memoised); its cost on large pages is unmeasured. A cheaper form: the server tags each link with its component IDs.
