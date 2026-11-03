---
goal: Make a pending $memo read give its promise instead of throwing a not-ready error, and add a React use-like read that unwraps it
date: 2026-11-03
rounds: 3 of 3
status: rejected
roadmap: none
supersedes: none
decision: docs/decisions.md (the $resolve entry, 2026-11-03)
---

# Debate: `$memo` reads that give a promise, and a `use`-like unwrap

Rejected by the maintainer on 2026-11-03: the stale value is the deciding cost. A promise from a read is the load of one run, so `await m` can settle with a value for inputs that have changed since (O1). Nothing below is built, and the spike is not added.

The maintainer's reason (Q1): simpler async handling, and types that show whether a memo is async. The goal's "like Solid" does not match Solid: Solid 2.0 throws `NotReadyError` on a pending read, which is what brumate does now (J1, J5). The model the maintainer described is React's: an async memo is a `Promise<T>`, and `use` unwraps it (J6).

Options weighed: `$use` alone over today's reads (P1, P7), promises in handlers only (P2, P3, P8), an explicit `$promise(memo)` (O6), the full React model (P9-P21), handler-only typing (P22), and a report-only spike first (O19).

## Settled structure

The full model is not built now. A spike measures its cost first, and the first thing to ship is types only.

1. **Report-only spike** (O19, P16, O18). Type every async memo as `Promise<T>` in the checker's view of `.brm` files, and run the checker over the whole repo (O10, O14: the 28-of-590 grep is a floor). It ships nothing. It reports:
   - the number of type errors, by kind: script reads, memo computes, handlers, effects, `$client` callbacks (O15)
   - the async memos the inference misses: inline `'use server'` functions, helpers that return promises, memos derived from async memos (O14)
   - whether TypeScript flags `if (m)` on a `Promise<T>` in `.brm` scripts, since no type-aware lint exists (O8, J12)
   - one browser test where a derived memo and a direct one render `{m}` the same (P19, O13), and one where a promise from a read stays the same object for one load (O17)
2. **Handler-only typing** (P22, O19), if the spike shows the inference finds the async memos. Async memos are typed `Promise<T>` only in handlers, handler props and `$client` callbacks, where the runtime already refuses a pending read (BRM182) and `await $resolve(m)` is the answer. Runtime reads, markup and memo computes do not change. No `$use`: with bare reads unchanged it is a second spelling with no new behavior (O4).
3. **The full model** (P9, P11, P12, P17, P19) waits as a later story, after values-build (O7, J9) and behind the spike's measured count. It would make an async memo `Promise<T>` at every bare read, with `$use(m)` as the unwrap in computes and scripts, and one pending rule for `{m}`: markup waits for the current promise and keeps what it shows on later loads (P19). `await $memo`, `$isPending`, `#loading (m)`, `NotReady` and `$resolve` all stay (P11, O16, J13). It reverses decisions.md:26 and :135, so it needs its own decision.

## Budget

- client bytes: 0 B for steps 1 and 2, which are types only. Step 3 has no measured figure. Its runtime shrinks by about 20 to 40 lines at most, and it moves `$resolve`'s waiter logic into every read (P14, O16).
- time: step 1 is one M spike, about 3 days. Step 2 is about 3 days, one M node. Step 3 is not estimated with any calibration, and it follows values-build (P16, O18).
- tokens: about 300k for the spike with a fresh review, and about 300k for step 2. Both are uncalibrated estimates (P5, O5).
- device: no cost beyond a normal worktree.

## Rejected

- `$use` over today's reads (P1, P7): it emits the same read as a bare read and adds a name, not a capability (O4).
- A pending read gives the raw promise in handlers, typed `T | Promise<T>` (P2, P3, P8): `await m` can settle with a stale run's value (O1), and a promise is always truthy, with no lint to catch it (O2, O8). The pending-handler-reads debate already rejected this shape (J2).
- A no-op catch on the read's promise (P13): it swallows errors that reach the handler error path today (O9).
- `$promise(memo)` (O6): `$resolve` already gives `Promise<Awaited<T>>` explicitly, and a variant that skips the current inputs carries O1.
- Dropping `$resolve` under the model (P20): 14 call sites use `timeout` or `signal`, and a read that follows the latest load carries the same machinery (O16, J13).
- Go and kill gates of 60 and 100 errors (P21): they have no baseline, and they rest on the heuristic that O14 showed is unreliable (O18).

## Proofs

- None. The open questions need a checker run over the repo, which is a spike of days, not a 30-minute proof.

## Prior art

- Solid 2.0: a read before the first value throws `NotReadyError`, `<Loading>` catches it, and `resolve(fn)` is the explicit wait. Solid 1's `createResource` gave `undefined` while loading (J5).
- React `use(promise)`: it suspends by throwing, and the promise must be stable across renders. A promise in state or props is a plain value (J6).
- Marko 6: a promise is a plain value, and only `<await>` unwraps it. Svelte 5 async: `await` in scripts, `$derived` and markup, with a boundary that keeps the old UI on updates (J7).
- docs/debates/pending-handler-reads: passing the raw promise to handlers lost, and the explicit `$resolve` won (J2).

## Open risks

- The real break count and the misses of async inference (P17, O14, O15): measured by the spike.
- Promise identity per load (P18, O17): a test in the spike. Step 3 needs one stable promise per load for "latest wins".
- `{m}` showing the same thing whether `m` is direct or derived (P10, O13): a test in the spike.
- The full model's runtime cost and its interaction with the client restructure (P9, O7): deferred until after values-build.
- `await m` as a snapshot of the inputs at read time in step 3 (P12, O1): accepted as a documented semantic if step 3 is approved, with `$resolve` for the latest value.

## Inferred choices

- Breaking changes are minor bumps in 0.x, with no deprecation period, and 0.6.0 has about 8 feature slots (J8): from GOAL.md and the maintainer.
- Client size is a release goal, so steps that touch the runtime wait for the client restructure (J9): from decisions.md:140.
- Q2 (is it worth it if only markup triggers a boundary) was answered by inference: the maintainer named types as a reason on its own (Q1), so approving this file decides the trade.

## Answers from the user

- Q1, what the change should buy: simpler async handling and better type inference, so users know from the type whether a memo is async. The maintainer saw two places that trigger a loading boundary, effects and host markup. J11 corrects that: effects never run on the server or on page load, so only markup reads trigger a server boundary today, and that stays true under the model (P15).

## Overruled

- The whole result: the maintainer dropped the idea, steps 1 and 2 included, because of the stale value (O1).

## Cost of this debate

- 3 of 3 rounds, about 394k tokens.
