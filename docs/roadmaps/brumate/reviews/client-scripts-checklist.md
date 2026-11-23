# Checklist: client-scripts story (added 2026-11-23)

The design was argued in [the debate](../../../debates/vite-client-scripts/debate.md). This pass covers the categories of the blindspots checklist for the story only, as for any node added mid-roadmap.

- **Data and migrations**: N/A. No stored data or format changes.
- **Compatibility**: a breaking change to the `handle` options (the default) and the example layout. Allowed with no deprecation period (GOAL.md constraints). An explicit `scripts` keeps today's output (default-scripts acceptance). The plugin keeps a user-set `appType` (dev-pages).
- **Auth and permissions**: N/A. No new callers. Server function calls keep their RPC middleware, which runs before the page middleware (dev-pages).
- **Failure modes**: a missing client build is a build error (default-scripts). A render error shows the Errors tab page (dev-pages). User-set `spa`/`mpa` gives a warning, not silent 404s (dev-pages).
- **Concurrency**: N/A. One dev server. A stream that fails after the headers were sent logs and ends the response, as the preview page does (dev-pages).
- **Limits**: streamed bodies are piped, not buffered (dev-pages, brumate-node test with a chunked body).
- **Security**: the dev middleware runs only in `vite dev`. The production entry tag comes from the build's own manifest, not from the request. CSP nonce setups keep an explicit `scripts` (default-scripts).
- **Observability**: N/A. The `onTrace` spans of a request are unchanged, since `handle` is the same.
- **Performance**: no runtime cost in production: the tag is a build-time string. The todos bench click checks run in examples-glue.
- **Testing**: unit tests per child, the fixture app with no server file (dev-pages), the Nitro dev and build e2e (nitro-scripts), root `pnpm test` and all e2e suites (examples-glue), and the guard test against `@vite/client`.
- **Local files**: N/A. No gitignored files needed.
- **Developer experience**: client-scripts-docs rewrites getting-started, deploying and reference-plugin, and updates the skill.
- **Rollout**: ships in 0.10.0. `scripts` and `middlewareMode` are the opt-outs.
- **Cleanup**: examples-glue deletes the glue files. `benchmarks/brumate-0.3` stays, pinned to 0.3.0.
- **Coverage**: every step of the debate's settled structure maps to a child: 1 to default-scripts, 2 to default-scripts, 3 to dev-pages, 4 to nitro-scripts, 5 to brumate-node, examples-glue and client-scripts-docs.
- **Dependencies**: none new.

## Premortem

1. The manifest path differs under Nitro (`.output/public`) and production pages name no entry. Mitigation: default-scripts reads the client environment's `outDir`, and nitro-scripts runs the Nitro build test. A wrong path is fixed in nitro-scripts.
2. The e2e suites hard-code `node server.ts` and ports, so repointing them takes longer than the code. Mitigation: examples-glue is sized M for that. The debate's 6–10 day range counts it as the main cost.
3. Vite's middleware order changes between versions and the post hook sees rewritten URLs. Mitigation: `appType: 'custom'` plus a dev-pages test that runs with no `appType` set.
4. `website/scripts/dev.ts` serves the docs site with its own logic (several roots), and dropping its tags breaks the site in dev. Mitigation: examples-glue owns it and must run the website e2e. If the site needs its own server, it keeps one without `scripts`.
5. Workers run in parallel on `vite.ts`. Mitigation: dev-pages has a hard edge on default-scripts. brumate-node touches no shared file but `package.json`. The machine runs one worker anyway (debate J1).
