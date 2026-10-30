# Outcome: try-sample-console

## Built

- `website/src/live/run.ts`: `runSample` renders with `dev: true`.

## Deviations

- The fix is in `website/src/live/run.ts`, outside the brief's shared paths. The cause is the runner of live samples, not the sample, the e2e step or the core. The server runtime logs a caught error in production on purpose, so the core is unchanged.
- No changeset: no package changes.

## Stubs left

- None.

## Gotchas

- A live sample runs the server render in the browser. Anything the server runtime does in production, such as logging or hiding error messages, shows in the sample.

## Proposed learnings

- None.

## Verification

- `node e2e/run.mjs --only website --no-build`: before, "/docs/control-flow: 10 live samples render" failed with `Error: Not connected`. After, 72 steps pass.
- `pnpm lint` (only the warnings of main, no-shadow in e2e), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter website check:samples` and `pnpm --filter website build` pass.

## Size

- Estimated S, actual S.
