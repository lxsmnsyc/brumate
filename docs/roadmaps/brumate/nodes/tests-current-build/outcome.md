# Outcome: tests-current-build

## Built

- packages/ui/vitest.config.ts imports the plugin from `../brumate/src/vite.ts` and aliases every runtime export of brumate (server, client, loader, static-loader, context, html, signals, testing, env, routes, batch, events, serial, stream, forms/core, devtools, hot) to `packages/brumate/src/runtime/*.ts`. The ui tests no longer read packages/brumate/dist.
- No changeset: packages/ui is private and the config is not shipped.

## Deviations

- None. The brief's `verify` command is not a proof (see Gotchas).

## Stubs left

- None. The website has no tests; docs-generator adds them with the same alias idea.

## Gotchas

- A new export in packages/brumate/package.json needs a line in the alias map of packages/ui/vitest.config.ts, or the ui tests would fall back to dist for it.
- Type checks (`brumate-tsc`) still read brumate types from dist, so build brumate and tsc before them.
- The brief's verify (the button test) passes with a stale dist. Proposed verify: `mv packages/brumate/dist packages/brumate/dist.away; pnpm --filter @brumate/ui exec vitest run; mv packages/brumate/dist.away packages/brumate/dist`. Without dist, it fails on the old config.

## Proposed learnings

- The test config of a package aliases workspace dependencies to their source | a stale dist hides compiler changes | packages/ui | no

## Verification

- Before the change, no dist: the button test failed on `brumate/testing`.
- After: with dist built and then moved away, `npx vitest run --maxWorkers=2` in packages/ui: 54 files, 505 tests passed.
- `npx oxlint` exit 0, `npx oxfmt --check` exit 0, `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui exit 0 (a deliberate type error made it exit 2).
- Not run: the other packages' tests, e2e.

## Size

- Estimated S, actual S.
