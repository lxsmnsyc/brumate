# Outcome: client-scripts-docs

## Built

- `website/docs/getting-started.md`: "Serve pages in development" is `pnpm vite dev`, with no `server.ts` in the layout and no `manifest: true` in the config. Bullets say what the plugin answers, that brumate adds the script tags, the error page, the 404 and the `appType` default. The two hand-written tags are gone. A paragraph under "Edit while it runs" says that the tags of `vite dev` load `virtual:brumate/start`, not the client entry (see Gotchas).
- `website/docs/deploying.md`:
  - The lead says Nitro is the production server and brumate has no adapters. The Nitro section adds bullets for `nonce` and `prerender`, says the entry writes no tags, and lists the five examples that run on Nitro.
  - "A server of your own" replaces "Build" and "A production server": development (`server.ts` with `middlewareMode` and `toNodeHandler`), the two builds with `clientOutDir` and the "Build the client first" error, and production (`server.prod.ts` with `toNodeHandler`, no manifest read, no `node.ts`, no `scripts`).
  - "The script tags" paragraph: the default in dev and build, an explicit `scripts` (including `''`) replaces it and is written as given, and `nonce` is the way to a nonce policy.
  - "Early hints" is a top-level section, with the srvx and Nitro `writeEarlyHints` call and `clientOutDir` instead of `prerender: { client }`.
  - "Prerendering" has "Under Nitro" (after the server environment, files to `.output/public`, `#defer` pages to server assets as shells that `handle` sends, the routes in their own environment, why not Nitro's `prerender`) and "With two builds". The `#defer` and CSP subsections cover Nitro shells (nonce of the request), `'self'` for files, and the `shell: true` entry.
  - Skew protection and the checklist no longer assume `dist/client`.
- `website/docs/reference-plugin.md`: new `clientOutDir` row, the `prerender` row and `PrerenderOptions.client` default updated for Nitro, a new "The dev server" section (`appType: 'custom'` default, skips for `middlewareMode`, Nitro and `spa`/`mpa` with the warning text), `errorPage` says `vite dev` uses it, and the modules paragraph says `handle` writes the tags.
- `website/docs/reference-security.md`: the nonce example is `handle(request, { nonce })` with `script-src 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'`, no hand-written tag. Bullets for the default tags, explicit `scripts`, `renderToStream`, prerendered files and kept pages (0.9.1). The Trusted Types policy line uses `'strict-dynamic'`.
- `website/docs/routing.md`: "Caching pages" says a kept page gets the request's nonce from 0.9.1, and a page with the nonce elsewhere is not kept (kept-page-nonce). "Serving routes" drops the `ssrLoadModule` sample with a hand-written tag.
- `website/docs/reference-server.md`: one line after `DocumentOptions`: `scripts` has no default outside the `handle` of `virtual:brumate/routes`.
- `packages/brumate/README.md`: no `manifest: true`, one line on `vite dev`, Nitro and Deploying.
- `packages/brumate/skills/brumate/SKILL.md`: one rule: never write the client script tags; `handle` adds them, production is Nitro or `toNodeHandler`, a nonce goes through `handle(request, { nonce })`. The skill had no server examples with tags.
- `packages/brumate/test/no-hand-scripts.test.ts`: `KNOWN` removed. The test expects no `@vite/client` at all in its roots.

## Deviations

- Edited `website/docs/routing.md`, `website/docs/reference-security.md`, `website/docs/reference-server.md` and `packages/brumate/README.md`, outside `owns` and `shared`. The task named reference-security and the cache docs, and the others held stale samples or `manifest: true`.
- The docs never write the string `@vite/client`, since the guard test now allows none. They say "the Vite client".

## Stubs left

- None.

## Gotchas

- For the orchestrator: under `vite dev` and under an own dev server that passes no `scripts`, the default tags load `virtual:brumate/start`, not the app's client entry. An entry that calls `start` itself (`website/src/client.ts` with its live-sample `load`, `examples/trace/src/client.ts` with `onTrace`) does not run in development. `website/scripts/dev.ts` lost its `scripts` in examples-glue. Seen in `packages/brumate/src/routes.ts` (`devScripts`) and `vite.ts` (`defaultScripts`), not run in a browser. The docs state the current behavior. A fix could load the client entry (from `build.rolldownOptions.input` or the client environment's input) in dev.
- `routing.md` and `reference-security.md` say kept pages get the request's nonce "from brumate 0.9.1". That holds once kept-page-nonce ships.

## Proposed learnings

- A doc names the Vite client in words, not by its path | the guard test counts the path in `website/docs` | website/docs | yes (no-hand-scripts.test.ts)

## Verification

- `pnpm --filter brumate exec vitest run test/no-hand-scripts.test.ts test/skill.test.ts`: 103 passed.
- `rtk proxy pnpm lint`: 0 errors (warnings only). `pnpm format:check`: pass. `pnpm typecheck`: pass.
- `pnpm --filter website check:samples`: 72 samples, 0 problems. `pnpm --filter website test`: 345 passed. `pnpm --filter website build`: pass.
- `check_prose.py` on the changed pages: 0 errors. Long-sentence warnings in the new lines were split.
- `surface.py --base main`: the only stale mention was the getting-started tag, now removed.
- Self-review round 1 (brief goals before the diff, then the diff): every goal and note is covered. It found the dev client entry gap above, which is documented and not fixed, since it is code.

## Size

- Estimated S, actual S.
- Risk estimated low, measured low.
