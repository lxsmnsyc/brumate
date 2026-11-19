# Outcome: async-effects

## Built

- `$effect(async () => ...)` and `$client(async () => ...)` compile. `declareEffect` in `packages/brumate/src/analyze.ts` no longer reports for `async`. `BRM096` is gone from `error-catalog.ts`, the generated `website/docs/errors.md` and skill `references/errors.md`. Its line in `test/error-codes.json` stays.
- `packages/brumate/src/codegen/client.ts`: `effectCall` emits `$$b.asyncEffect` for an `async` callback and `$$b.effect` for the rest, for `$effect` and `$client`.
- `packages/brumate/src/runtime/client/async-effect.ts` exports `asyncEffect(scope, name, callback, client?)`, re-exported by `runtime/client.ts`. A page without an async effect does not load it.
  - State is a `Run` record per scope and name in a `WeakMap<Scope, Map<string, Run>>`: `busy`, `again`, the cleanup of the last settled run, and a per-run `gone` token that `stop` sets.
  - `scope.cleanups` keeps `() => void`: `stop` never waits. A pending run cleans up when it settles. An idle run cleans up at once and holds `busy` until the cleanup settles.
  - Changes while `busy` set `again`. Changes that come while the cleanup of the run before runs are that run, since the callback reads live values after it. One run starts after the rest settles, only if the scope is still in `scopes`.
  - A rejection of the run or of a cleanup goes to `fail(scope, error)`.
- `runtime/client/updates.ts`: shared by `effect` and `asyncEffect`: `toCleanup` (function, `[Symbol.asyncDispose]`, `[Symbol.dispose]`), `reportCleanup` (devtools, and `fail` for a rejected promise of a sync effect's cleanup), `skipEffect` (the `NotReady` skip, moved out of `effect`), `enterEffect` (origin and `runningEffects` for the synchronous part). `NotReady` is exported.
- `NotReady` before the first `await` skips the run. After an `await` nothing counts as running, so the read throws the usual error, which goes to `fail`. No extra code.
- Devtools: `effect()` hook gets kinds `pending` (a run starts, dev only) and `skip`. `EffectEntry.pending` is set by `pending` and cleared by `run` or `skip`. The dock does not show it yet (follow-up).
- Types: `Cleanup` type and `$effect`/`$client` callback type `() => void | Cleanup | Promise<void | Cleanup>` in `runtime/signals.ts`. `tsconfig.json` `lib` gained `esnext.disposable`.
- Tests: `packages/brumate/test/async-effects.test.ts` (27 tests): compiler switch, each rule, each cleanup form for sync and async effects, hide and show, `$client`, `NotReady` before and after an `await`.
- Docs: `website/docs/effects.md` (new "Async effects" section, `$resolve` advice), `async-data.md`, `reference-signals.md`, `docs/decisions.md` (new line after the `$effect` entry; no existing line said the callback cannot be async). Changeset `.changeset/async-effects.md` (minor).

## Proof

Not a fix node.

## Deviations

- Extra files edited outside the brief list: `packages/brumate/src/runtime/client/state.ts` (devtools hook kinds), `packages/brumate/skills/brumate/references/errors.md` and `website/docs/errors.md` (generated), `website/docs/async-data.md` and `website/docs/reference-signals.md` (said the callback cannot be async).
- Rejections of the run reach `#catch` in `resume.test.ts` (fixture `render/asyncEffectTry.brm`). The unit tests use `onError`.
- Two extra test paths: `test/async-effects-build.test.ts` (bundle search) and the fixture above.
- `docs/decisions.md` got a new entry because no line said the callback cannot be async.

## Stubs left

- The dev dock does not show `pending` yet.

## Gotchas

- `effect-copy-warning`: `declareEffect` in `analyze.ts` has no `async` check now. An async callback is a normal effect site for analysis, and its reads after an `await` count.
- `asyncEffect` sets `busy` before it calls the callback, so a write in the synchronous part that runs the same effect makes one run after it.
- A hidden `#offscreen` body: `hide` calls `stop`, which runs an idle cleanup at once. The show call finds `busy` and waits by rule 2.
- Errors of a rejected cleanup of a sync effect now go to `fail` (they were unhandled before).

## Proposed learnings

- A callback of `$effect` or `$client` is allowed to return a promise, so code that wraps the callback result must not assume a sync value | the compiler picks `asyncEffect` from `callback.async` only | packages/brumate/src/codegen | yes

## Verification

- `pnpm lint` (warnings only, none new in the node), `pnpm format:check`, `pnpm typecheck`: pass.
- `cd packages/brumate && npx vitest run test/async-effects.test.ts test/check-command.test.ts`: pass.
- `pnpm build && pnpm test`: 5 failures (differential-1, differential-2, resume.test.ts) under load average 12; the three files pass when rerun alone (935 tests).
- `node e2e/run.mjs` (load average 12): website 73/74 (a 30 s navigation timeout) and ui 18/19 (Toast timer) failed; a rerun of `--only ui` passed Toast and failed another timing test (Tooltip delay). todos, tracker, nitro, kit and browser-async pass. Load noise, not hunted.
- `pnpm bench --only brumate --scenario todos`: total JS after counter, toggle, add 33.2 kB raw / 13.8 kB gz; client JS in dist 84.9 kB raw / 29.9 kB gz.

- Sync-path cost: a built client (minified, one page with a sync `$effect`) is 95916 B raw / 31516 B gz on `batch/brumate-release-0.9` and 96204 B raw / 31563 B gz on this branch: +288 B raw, +47 B gz (brief estimate about 60 B gz). Not a gate.
- `test/async-effects-build.test.ts` builds a real client with Vite: no `asyncEffect` in a sync-only bundle, and `function asyncEffect(` in an async one.
- `test/resume.test.ts` has a test with `test/render/asyncEffectTry.brm`: a rejection of an async effect renders the `#catch` of its `#try`.
- `Cleanup` in `runtime/signals.ts` says `object` for the disposables, so the d.ts needs no `esnext.disposable` lib in a user project. `packages/brumate/tsconfig.json` keeps that lib for the source.

## Size

- Estimated M, actual M.

Landed on batch/brumate-release-0.9 as 55cc81e2.
