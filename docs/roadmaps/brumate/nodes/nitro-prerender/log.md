# Log: nitro-prerender

## Proof of the problem (2026-11-26)

On the untouched branch (feat/client-scripts, a741acca + the brief), after `pnpm install --frozen-lockfile` and `pnpm build`:

- `cd examples/tracker && pnpm build`: Client, SSR and Nitro environments build. `find .output/public -name "*.html"` lists nothing. The config has no `prerender` option any more (examples-glue removed it).
- Same build with the old option restored in `vite.config.ts` (`prerender: { paths: ['/about', '/from', '/team', '/titles', '/titles/other'], crawl: false }`): still no `.html` file, and no "Prerendered N pages" line. So the plugin ignores `prerender` in an environment build.

## Notes

- Why: `config()` adds the `brumate-routes` entry only `if (env.isSsrBuild)`, and `writeBundle` prerenders only `if (isSsrBuild)`. Nitro runs `vite build` (not `--ssr`), so `config.build.ssr` is unset.
- Side finding: in a Nitro build the client's `.brumate/hints.json`, `build.json` and `builds.json` land in `examples/tracker/dist/.brumate`, not in `.output/public/.brumate`, because `outDir` is the top-level `build.outDir`, not the environment's. Not part of this node.

## After the fix

- Emit routes as entry in the `load` hook of a server environment, prerender in its `writeBundle`. Tracker build: "Prerendered 6 pages".
- Nitro serves files before the entry. With `/about` prerendered, the e2e step for `/about` fails (no signed-in line). Moved `/about` and `/team` back to per-request rendering.
- Restored #defer stylesheet step cannot pass: a rendered `/about` has no body request (the browser renders the body), a static one gets the file back. Removed it, added a step for the static pages.
- Docs not edited (client-scripts-docs owns them). Notes are in outcome.md.

## Round 2

- Shells as Nitro server assets via the `nitro` key of the Vite config (Nitro reads `userConfig.nitro`). `handle` reads them with `nitro/storage`.
- Build IDs under Nitro: server, client and build.json had three IDs. Fixed, test added.
- The old stylesheet step cannot pass with a shell: no body request from the browser.
