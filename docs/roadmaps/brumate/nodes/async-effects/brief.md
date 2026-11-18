---
id: async-effects
title: Async callbacks in $effect and $client
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target: 
ship: auto
land: auto
from: 
size: M
spike: false
hypothesis:
verify: cd packages/brumate && npx vitest run test/async-effects.test.ts test/check-command.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared:
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/client/async-effect.ts
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/signals.ts
  - packages/brumate/src/runtime/devtools.ts
  - packages/brumate/test/async-effects.test.ts
  - packages/brumate/test/error-codes.json
  - packages/brumate/test/__snapshots__/**
  - website/docs/effects.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

> 2026-11-18: refined from the outline. A must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md).

# Async callbacks in $effect and $client

## Goal

`$effect(async () => { ... })` and an async `$client` callback compile. The compiler emits `$$b.asyncEffect` for them and `$$b.effect` for the rest, so a page without an async effect ships no code for it. `BRM096` goes. The five rules of [Async effects](../../../../proposals.md#async-effects) hold:

1. A stale run cleans up as soon as it settles.
2. One run at a time. The next run starts after the run before it and its cleanup have settled, and changes that come meanwhile make one run.
3. A scope that goes does not wait for a pending run.
4. A rejection of the run or of its cleanup goes to `fail(scope, error)`.
5. The cleanup is a function, an async function, or an object with `[Symbol.dispose]` or `[Symbol.asyncDispose]`.

## Current state

- `declareEffect` reports `BRM096` for `callback.async` (`packages/brumate/src/analyze.ts:1813`). The catalog entry is at `packages/brumate/src/error-catalog.ts:662`, and the code is pinned in `packages/brumate/test/error-codes.json`.
- `$effect` and `$client` are typed `() => void | (() => void)` (`packages/brumate/src/runtime/signals.ts:112`, `:117`).
- Both emit `$$b.effect($$s, name, callback[, 1])` (`packages/brumate/src/codegen/client.ts:1030` for `$client`, `:1135` for `$effect`).
- `effect` (`packages/brumate/src/runtime/client/updates.ts:1019`) runs the old cleanup (`scope.cleanups.get(name)?.()`, `:1032`), calls the callback, sends a throw to `fail(scope, error)` (`:1075`) and keeps only a function as the cleanup (`:1080`). A hidden `#offscreen` body returns first (`hiding?.paused`, `:1026`), and the body calls `effect` again when it shows.
- `scope.cleanups` is a `Map<string, () => void>` (`runtime/client/state.ts:99`). It runs when a scope is removed (`scopes.ts:98`), when a body hides (`branches.ts:478`) and when a page is left (`resume.ts:439`). All three call it without waiting.
- `fail(scope, error)` is in `runtime/client/errors.ts:22`.
- The analyzer takes the reads of the callback by name, so a read after an `await` is already a dependency of the site. The write after an `await` makes its own pass, as in a handler.
- `website/docs/effects.md:36` says "an effect callback cannot be `async`" and sends the reader to `$resolve(memo).then(...)`.

## Prior art

Pinned SHAs: silmaril [910f4c1](https://github.com/lxsmnsyc/silmaril/tree/910f4c1052b6be5ff5eb15690b21ede42ef06886), Svelte [dd3f1c2](https://github.com/sveltejs/svelte/tree/dd3f1c2ad9017380836410a63fe53cd4a8a1b9ba), Solid [82f71fd](https://github.com/solidjs/solid/tree/82f71fddb1340cab46167db119da5702038e65ab), Vue [148fdac](https://github.com/vuejs/core/tree/148fdacdc3a67aaa2b8d1b615da227c3fcc2df53), React [6ff2574](https://github.com/facebook/react/tree/6ff257439b3919fc8dcc643b635e09d62fa74d0e).

| Rule | silmaril | Svelte 5 | Solid 2.0 | Vue | React | brumate (this node) |
| --- | --- | --- | --- | --- | --- | --- |
| Async callback | `$` takes an expression and runs it in a microtask ([README](https://github.com/lxsmnsyc/silmaril/blob/910f4c1052b6be5ff5eb15690b21ede42ef06886/README.md#L236)). No async form. | Typed `() => void \| (() => void)` ([`effects.js:373`](https://github.com/sveltejs/svelte/blob/dd3f1c2ad9017380836410a63fe53cd4a8a1b9ba/packages/svelte/src/internal/client/reactivity/effects.js#L373)). An async callback returns a promise that is not a teardown, so it is ignored without a message. Svelte has no compile error for it. | `createEffect(compute, effect)` splits tracking from the effect ([`signals.ts:589`](https://github.com/solidjs/solid/blob/82f71fddb1340cab46167db119da5702038e65ab/packages/signals/src/signals.ts#L589)). The compute may return a promise, which Solid awaits before it calls the effect. | `watchEffect(effect)` gives the callback `onCleanup` ([`apiWatch.ts:56`](https://github.com/vuejs/core/blob/148fdacdc3a67aaa2b8d1b615da227c3fcc2df53/packages/runtime-core/src/apiWatch.ts#L56)). Reads after an `await` are not tracked. | `useEffect` warns when the callback returns a promise ([`ReactFiberCommitEffects.js:203`](https://github.com/facebook/react/blob/6ff257439b3919fc8dcc643b635e09d62fa74d0e/packages/react-reconciler/src/ReactFiberCommitEffects.js#L203), `:228`). | Compiles. The compiler picks `asyncEffect` from `callback.async`. |
| Stale run | none | An async cleanup is lost. | The compute is superseded, and the old promise is dropped. | `onCleanup` registered after an `await` is lost, so the user keeps a flag. | The user keeps a flag. | Rule 1: the run cleans up when it settles. |
| One run at a time | none | no | no (latest wins) | no | no | Rule 2. |
| Rejection | n/a | unhandled | goes to the error boundary | `watchEffect` calls `callWithAsyncErrorHandling` | unhandled | Rule 4: `fail(scope, error)`. |
| Cleanup forms | `onDestroy(fn)` ([README](https://github.com/lxsmnsyc/silmaril/blob/910f4c1052b6be5ff5eb15690b21ede42ef06886/README.md#L379)) | function | function; a non-function is a dev error ([`signals.ts:758`](https://github.com/solidjs/solid/blob/82f71fddb1340cab46167db119da5702038e65ab/packages/signals/src/signals.ts#L758)) | function | function | function, async function, disposable (rule 5). No one of the five accepts a disposable, so this one is brumate's own. |

No prior art does rules 1 and 2 together. The proposal names the rules, so they are the API. Brumate keeps the form `$effect(async () => ...)`, with no `onCleanup` parameter, because `BRM095` rejects parameters.

## Decisions

- One node, size M. The runtime and the compiler switch are small and test against each other, so a split into two nodes would only add an edge.
- New file `runtime/client/async-effect.ts` exports `asyncEffect(scope, name, callback, client?)`. `runtime/client.ts` re-exports it, so a page that never calls `$$b.asyncEffect` drops it (the same way `timed` is dropped). The compiler emits `asyncEffect` when `callback.async` is true, for `$effect` and `$client`.
- Per-effect state is a record in a `WeakMap<Scope, Map<string, Run>>` or on the entry of `scope.cleanups`, with `busy` (a promise), `again` (a change came while busy) and `gone` (the scope or body went). The decision of the form is the worker's, with a test for each field.
- `scope.cleanups.set(name, stop)` keeps the type `() => void`. `stop` sets `gone`, runs the cleanup at once when the run has settled and returns. When the run is pending, `stop` marks it stale, and the run calls its cleanup when it settles (rule 1). It never waits (rule 3).
- Rule 2: `effect`-style calls while `busy` set `again` and return. When the run and its cleanup settle, one run starts if `again` is set and the scope is still in `scopes` and not `gone`. The run reads the signals at that time, since the callback reads live values.
- A hidden `#offscreen` body: `hiding?.paused(scope, name)` stays the first check. When the body shows, the call waits on `busy` by rule 2.
- A pending memo read (`NotReady`) before the first `await` skips the run as in `effect`. After an `await`, a `NotReady` goes to `fail`, since a skipped run cannot be repeated halfway. The worker adds a test and a line to the docs.
- A `$client` callback runs once, so only an `#offscreen` show makes a second run.
- Sync `effect` takes the same cleanup forms: a shared `toCleanup(value)` in `updates.ts` turns a function, a disposable or an async disposable into one function, and the result of an async cleanup goes to `fail` on rejection. It adds about 60 B gzip to every page. Size is recorded, not a gate (GOAL.md, 2026-11-12). Report the figure in the outcome.
- `runningEffects` counts only the synchronous part of the callback, up to the first `await`. A write after an `await` makes its own pass.
- Devtools: a run reports `run` with its time when it settles. A new `pending` event goes out at its start in dev only. The dock does not show it yet (follow-up note in the outcome).
- Types: `$effect` and `$client` accept `() => void | Cleanup | Promise<void | Cleanup>`, with `Cleanup = (() => void | Promise<void>) | Disposable | AsyncDisposable`. `lib` of `packages/brumate/tsconfig.json` must hold `esnext.disposable`. The worker checks it and adds it if it is missing.
- Not in this node: an `AbortSignal` for a stale run (proposal, "Left for later").
- `BRM096` is deleted from the catalog and its number stays unused. The line in `test/error-codes.json` stays. Nothing else is added, so no code is reserved.

## Acceptance

- [ ] `$effect(async () => { ... })` and `$client(async () => { ... })` compile, and the output calls `$$b.asyncEffect`. A page with sync effects only has no `asyncEffect` in its client code (a build test searches the bundle).
- [ ] Tests in `packages/brumate/test/async-effects.test.ts`, each one for one case of the proposal list: a run that goes stale and settles after the next change; a scope that goes while a run is pending; two changes while a cleanup is pending make one run; a rejection in the run and a rejection in the cleanup reach the `#catch` of a `#try`; each cleanup form of rule 5 for sync and async effects; a read after an `await` re-runs the effect; a hidden `#offscreen` body waits for its cleanup when it shows; `NotReady` before and after an `await`.
- [ ] `BRM096` is gone from the catalog, the compiler and the skill text. `test/check-command.test.ts` passes with the pinned file.
- [ ] `website/docs/effects.md` documents async effects: the five rules, the write after an `await`, no `AbortSignal`, and the new advice for `$resolve`. Its line 36 no longer says the callback cannot be `async`.
- [ ] `docs/decisions.md` records the rules, replacing the lines that say an effect callback cannot be async.
- [ ] A minor changeset (new behavior of `$effect` and `$client`).
- [ ] Fast check passes: `cd packages/brumate && npx vitest run test/async-effects.test.ts test/check-command.test.ts`
- [ ] Before the pull request: oxlint, root `oxfmt --check`, typecheck, `pnpm test` at the root and the e2e run (batch rule).

## Sizing

M: the compiler, the browser runtime, the catalog, the types and the docs change together, and the five rules need a test each.

## Notes for the worker

- Probe first: write the smallest page with an async `$effect` that reads after an `await`, against main, to confirm the site reads before you change the runtime.
- Keep the diff of `effect` small. The async path lives in its own module so the sync path stays what it is, except `toCleanup`.
- Do not add parameters to the callback. `BRM095` stays.
- `effect-copy-warning` waits for this node, because both edit `declareEffect` and the effects docs.
