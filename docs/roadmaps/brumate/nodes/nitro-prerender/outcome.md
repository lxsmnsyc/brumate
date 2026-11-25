# Outcome: nitro-prerender

## Built

- `packages/brumate/src/vite.ts`: in a build of several environments (no `--ssr`), the server environment that loads `virtual:brumate/routes` also emits it as an entry (`brumate-routes`, `emitFile` in the `load` hook). Its `writeBundle` then runs `prerender()` on that chunk, into `clientDirectory()` (`clientOutDir`, `prerender.client`, or the output of the client environment, `.output/public` for Nitro). The pages, `404.html` and `.brumate/prerender.json` are written there, and the log says "Prerendered N pages". The two-step `--ssr` path is untouched.
- `packages/brumate/test/prerender-environments.test.ts`: three tests with a Nitro-like builder (client then a server environment whose entry exports no `handle`): pages, 404 and manifest are written into the client output; `paths` and `crawl: false` apply; no option writes nothing.
- `examples/tracker/vite.config.ts` prerenders `/from`, `/titles` and `/titles/other` again. `/about` and `/team` stay rendered on each request (see Deviations).
- `e2e/suites/tracker.mjs`: new step "Nitro serves the prerendered pages as files" (etag, last-modified and content-length on the three pages, none on `/about`). `e2e/README.md` and `examples/tracker/README.md` describe it.
- `.changeset/nitro-prerender.md` (patch).

## Proof

- base: a741acca plus the brief, `cd examples/tracker && pnpm build` with the old option `prerender: { paths: ['/about', '/from', '/team', '/titles', '/titles/other'], crawl: false }` put back. Result: no `.html` file under `.output/public`, no "Prerendered" line.
- branch: the same command with the three paths: "Prerendered 6 pages". `.output/public` has `from/index.html`, `titles/index.html`, `titles/other/index.html`, `404.html` and `.brumate/prerender.json`. `curl -i /about`-style check on `/from`: etag, last-modified and content-length, so Nitro serves a file.

## Choice: brumate's prerender, not Nitro's

Nitro's `prerender` (`nitro/dist/_chunks/nitro.mjs`, `prerender()`) builds the app a second time with preset `nitro-prerender`, crawls it with its own requests, and writes `route/index.html`. It passes no `prerender: true` to the routes (rate limits count), has no `shell`, does not write `.brumate/prerender.json` (inline script hashes for a CSP) or `404.html`, and does not take `paths`, `crawl` or `head`. Brumate's own keeps all of these as documented, and costs no second build.

## Round 2: shell pages and client files

- `packages/brumate/src/prerender.ts`: `prerender(..., shells?)`. With a shell directory, a page that has a `#defer` block (`<template b-b=".." b-defer="..">`) is written there, not to the client output. `.brumate/prerender.json` stays in the client output, and such a page has `shell: true`.
- `packages/brumate/src/vite.ts`: with Nitro in the config (a plugin named `nitro:*`) and `prerender` set, the plugin adds `nitro.serverAssets` (`baseName: 'brumate'`, dir `node_modules/.brumate/shells`) to the config, which Nitro reads. Nitro bundles the shells into `.output/server`.
- `packages/brumate/src/routes.ts`: in that case `handle` is async and, for a GET or HEAD without `options.shell`, reads the page from `useStorage('assets:brumate')` (`nitro/storage`, imported at the call) and passes it as `shell`. An explicit `shell` wins, and a prerender call skips it. The entries need no code.
- `examples/tracker`: `prerender` has the original paths again. `/from`, `/titles` and `/titles/other` are files in `.output/public`. `/about` and `/team` are shells, so the signed-in line loads.
- Client files: the client environment writes `.brumate/hints.json`, `build.json` and `builds.json` (and prunes old builds) in its own output (`output.dir`), not in the top-level `build.outDir` (`dist`). A server environment of a multi-environment build no longer runs that branch.
- Build ID: in a Nitro build each environment made its own random ID, so the server, the client and `build.json` all differed (seen in `.output`: three IDs). A server environment now keeps the ID of the client before it. Skew protection compared different IDs under Nitro before.
- Tests in `packages/brumate/test/prerender-environments.test.ts` (5): the hints and `build.json` are in the client output, none in `dist` or the server output, the server routes and the client code carry the `build.json` ID, and a Nitro-like config keeps `/team` out of the client files, with `shell: true` in the manifest.
- Changeset: `.changeset/nitro-prerender.md` now has two lines.

## Deviations

- The step "the #defer body waits for its own stylesheet" is not back. It passed in a server where the browser asked for the body (`x-brumate-defer`). A shell page sends the body in the same response, so the browser sends no body request and the step fails with "the body of the block did not link the stylesheet" (checked with a request log). I could not make a shell page ask. The shell is covered by the steps for `/about` and `/team` (signed-in line after a link and directly) and by the new step that checks `/from` and `/titles` are files and `/about` and `/team` are sent as shells (`b-hole`, no etag).
- Edits outside the owned and shared paths: none. Docs not edited.

## Stubs left

- None.

## Gotchas

- Notes for client-scripts-docs (`website/docs/deploying.md` Prerendering, and the `prerender` entry of `reference-plugin.md`):
  - In a Nitro build (`vite build`, no `--ssr`), `prerender` runs after the server environment. It writes the pages into the client output (`.output/public`), or `clientOutDir`. `prerender.client` is not needed.
  - Nitro serves a file in `.output/public` before the entry sees the request. So a page with a `#defer` block is not written there. The build writes it to server assets (`node_modules/.brumate/shells`), and `handle` reads it and sends it as the `shell`: the page, then the `#defer` bodies in the same response. No entry code is needed.
  - A page with a `#defer` block that names the user must be prerendered through this shell path (it is, in a Nitro build) or stay out of `paths`. A static host without a server keeps the fallback.
  - Without Nitro in a multi-environment build, every page goes to the client output.
  - Why brumate's prerender and not `nitro.prerender`: see "Choice" above.
  - Old text to replace: `deploying.md` Prerendering describes only the `--ssr` build; `README.md:64` and `routing.md:348` are true as they stand.
- Old note kept: `website/docs/deploying.md` (Prerendering) and the `prerender` entry of `website/docs/reference-plugin.md` should say that a Nitro build prerenders after its server environment into the client output (no `prerender.client` needed), that Nitro serves the files before the entry, so a page with a `#defer` block for the user must stay out of `paths` (no `shell`), and why brumate's prerender is used and not Nitro's. `README.md:64` and `website/docs/routing.md:348` are true as they stand (tracker has prerendered pages next to dynamic ones).
- Early hints were not broken under Nitro (the server reads `builtHints` in process), but a later server-only build would have read `hints.json` from `.output/public/.brumate`, where nothing was written. Skew protection was broken (three different IDs).
- `emitFile` of the routes as an entry changes the SSR chunk layout slightly (the entry chunk went from 403.9 kB to 404.0 kB in `.output/server/_ssr/ssr.mjs`), and only with `prerender` set.

## Proposed learnings

- Nitro serves any file in `.output/public` before the entry | the static middleware is global and runs first, so a page that needs the server must not be a file | examples/** | no

## Verification

- `pnpm lint` is `oxlint`. Its "ESLint output (JSON parse failed)" error came from the RTK hook, which rewrites `pnpm lint` into a filter that expects ESLint JSON. It is not a repo failure: `rtk proxy pnpm lint` exits clean (0 errors). It does not depend on the branch.
- `pnpm exec oxlint`: 0 errors. `pnpm format:check`: pass. Root `pnpm typecheck`: pass.
- `vitest run test/prerender-environments.test.ts test/prerender.test.ts test/default-scripts test/vite.test.ts test/styles`: 12 files, 132 tests passed.
- `node e2e/run.mjs --only tracker,nitro`: tracker 18 passed, nitro 2 passed (round 2).
- Round 2: `vitest run` prerender-environments, prerender, default-scripts, vite.test, styles, skew, routes: 14 files, 179 tests passed. Root typecheck, format:check pass. Dry start of `serveServer` on tracker: `/`, `/about`, `/from` 200.
- Dry start of `serveServer` (benchmarks/navigation/serve.mjs, `nitro: true`) on tracker: `/`, `/about`, `/from` answer 200. The bench was not run.

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium: the `load` hook emits an extra entry only with `prerender` set, in non-`--ssr` server environments.
