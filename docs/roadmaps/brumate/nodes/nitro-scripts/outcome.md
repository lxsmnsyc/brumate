# Outcome: nitro-scripts

## Built

- `examples/nitro/src/entry-server.ts` no longer imports `./client.ts?assets=client` and has no `import.meta.env.DEV` ternary or `scripts` constant. The entry is now:
  - imports: `setCacheStore`, `storageStore` from `brumate/server`, `useStorage` from `nitro/storage`, `handle` from `virtual:brumate/routes`, `handle as handleCall` from `virtual:brumate/server`.
  - `setCacheStore(storageStore(useStorage('cache')))` at the top.
  - `export default { async fetch(request: Request & { ip?: string }) { ... } }`: a POST goes to `handleCall(request, { address })` first, then `return (await handle(request, { address })) ?? new Response('Not found', { status: 404 });`, with `address = request.ip`.
- The default scripts do the rest: dev gets `/@vite/client` and the start module, the build gets the hashed client entry from the manifest. No change was needed in default-scripts' code; the manifest path follows Nitro's client `outDir`.
- `website/docs/deploying.md`: the Nitro snippet matches the entry (no `client` import, no `scripts`); the `waitUntil` line is `handle(request, { waitUntil: ... })`; the `?assets=client` bullet now says brumate adds the script tags, that the client builds first, and names `clientOutDir`.
- Stale mentions fixed in `examples/nitro/vite.config.ts` (comment) and `examples/nitro/README.md`.
- `nitro/vite/types` stays in `examples/nitro/tsconfig.json` (not needed for `?assets=client` any more, kept as Nitro's own types).
- No changeset: the example is private and the docs edit is not a package change.

## Deviations

- Edited `examples/nitro/vite.config.ts` and `README.md` (inside `examples/nitro/**`) for stale text.

## Gotchas

- examples-glue copies this entry for five examples: drop the `?assets=client` import and the `scripts` const, call `handle(request, { address })`. Their client build must come before the server build, and a client built to a custom directory needs `clientOutDir`.
- Examples read `brumate` from `packages/brumate/dist`: rebuild it before testing.
- `nitro/vite/types` may be removable from tsconfig; not tested here.

## Verification

- `pnpm lint`: warnings only. `pnpm format:check`: pass. Root `pnpm typecheck`: pass.
- `node e2e/run.mjs --only nitro`: 2 passed (dev and build). `pnpm --filter example-nitro test`: 3 passed (build test lines 39-45 hold).
- `vite dev` in `examples/nitro`, curl `/`: `/@vite/client` once, start module present.

## Size

- Estimated S, actual S.
- Risk estimated low, measured low.
