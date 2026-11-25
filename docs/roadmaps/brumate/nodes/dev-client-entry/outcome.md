# Outcome: dev-client-entry

## Built

- `clientEntryInput()` in `packages/brumate/src/vite.ts` is the one rule for the entry: the first input that is not `.html`, from `environments.client.input ?? build.rolldownOptions.input`. `clientEntryUrl()` resolves it through the client plugin container for dev (`/@id/__x00__...` for a virtual id, `/@fs/...` outside the root). `readEntry()` picks the manifest chunk of that input, and falls back to the first entry chunk.
- `devScripts(base, entry?)` in `packages/brumate/src/routes.ts` names that entry in the second tag, and the start module when there is none. `defaultScripts` and the self-contained component route use it.
- Docs updated: getting-started, deploying, reference-plugin, reference-security. Patch changeset `.changeset/dev-client-entry.md`.

## Proof

- base: 4673289b, `pnpm --filter brumate exec vitest run test/default-scripts -t "client entry of the app"`: fails, the page loads `virtual:brumate/start` and not `/src/client.ts`.
- branch: same command passes; the tag is `/src/client.ts` and the served module has the marker.

## Review fixes

- A virtual or bare input no longer 404s in dev. Dev and build now share one entry rule, with tests for both orders of two inputs, an HTML input first, and the `input` of the environment. The trace e2e suite has a step under `vite dev`.
- Component preview pages (the workbench frame) now run the app's entry too, as the app's pages do.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- With several inputs, the first is the entry. An app with only an `.html` input gets the start module.
- A server build run on its own sees only its own config. The manifest key rule works when the server build shares the client's `input` (`vite build --ssr <file>`) or the environments config; otherwise it falls back to the first entry chunk.
- A client entry that does not call `start` gets no loader in dev, as in the build.

## Proposed learnings

- Dev and build name the client entry from one config input | two sources drift | packages/brumate/src | no

## Verification

- `rtk proxy pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- vitest default-scripts, dev-pages, vite-app, routes, no-hand-scripts: 66 passed. `pnpm --filter website test`: 345 passed.
- `node e2e/run.mjs --only trace,website,nitro,tracker`: trace 6, website 81, nitro 2, tracker 18, 0 failed.

## Size

- Estimated S, actual S.
- Risk estimated medium, measured medium: every dev page now loads the app's entry, so an entry with side effects runs in dev.
