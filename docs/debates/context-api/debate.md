---
goal: Settle brumate's context API before the context-stores story continues, on two questions: Solid 2.0 style defaults or the key-only API, and whether $store reads a context directly
date: 2026-11-06
rounds: 2 of 2
status: superseded by ../context-read-fallback/debate.md
roadmap: docs/roadmaps/brumate
supersedes: docs/debates/context-no-defaults/debate.md
decision: none yet (the store-only-source node updates the `$store` and context-no-defaults entries of docs/decisions.md)
---

# Debate: the context API and `$store(Ctx)`

## Settled structure

- Question 1: keep the key-only API. `createContext(key)`, `$setContext`, `$getContext` (throws without a provider), `$hasContext` for optional reads, as Svelte 5.40 has it. No default value of any kind. (P7, O7, P13)
- Question 2: `$store` takes a store only, as silmaril's `$store(store)` does. A context's store is read with `$store($getContext(C))` or `$store(g.key)`, and an optional read with `$hasContext(C) ? $store(g.key) : undefined`. `$store(Ctx)` and `$store(undefined)` go. (P8, P11, O7)
- Work: node store-only-source as written (L, about 143 ui readers, compiler, runtime, types and docs), then store-bridge, store-repair-compare and the story PR. Nothing new is built in the runtime. (P11, O7)

## Budget

- device: no runtime code added; store-only-source removes the nullish paths (J4, O7).
- time: one L node before store-bridge; no new node (P11, O5).
- tokens: one worker run plus a fresh review, as for earlier L nodes (O5).
- safety: no default exists, so nothing module-global can be shared across requests (J3, O7).
- api: one spelling for each read, matching silmaril and Svelte (J6, J7, O6).

## Rejected

- Factory default written to the page's root scope per request (P1, P2): a first read in a streamed `#loading` chunk writes the root record after it went out (O2), and the 49 `store(null)` defaults would become per-request stores carrying a constant (O3). Conceded in P9.
- Literal-only defaults, Solid's primitives advice (P6, P12): 9 contexts and 12 of the 140 guarded reads, against the 4 `defaultValue` fallback sites of J4 coming back (O8).
- `$store(Ctx)` as sugar for `$store($getContext(C))` (P4): no store binder in silmaril, Svelte, Solid or React takes a context, and it gives two spellings of one read (O6). Conceded in P10.
- The work estimate of 3 to 6 runs for re-adding defaults (P5): calibration supports about 8 (O5).
- A site allocator for default stores (O1): not needed, a value-only store crosses the page state without an owner (J11).

## Prior art

- Solid 2.0 (2.0.0-rc.21): no default throws `ContextNotFoundError`; a value default stays, advised for primitives only because module scope is shared by every request; no `has` (J5).
- Svelte 5.40+ (5.57.3): `[get, set, has]`, `get` throws without an ancestor `set`; a store from a context is `getContext(K)` then `$s`; a nullish store gives `undefined` (J6).
- silmaril (992c6f57): `$store(store)` only, no nullish check, no contexts (J7).
- React: `createContext(defaultValue)` always has a default; `use(Context)` reads a context, `useSyncExternalStore` takes no context. Vue: `inject(key, default, treatDefaultAsFactory)` makes a factory default per read (J8).

## Open risks

- none. Every claim was ruled.

## Inferred choices

- Breaking changes are a minor bump with no deprecation period; contexts are static (J10).

## Answers from the user

- From this session on 2026-11-06, before the debate: `$store` follows silmaril's interface, `$store` of a nullish value is not allowed, and `let` keeps the write at the assignment (J9). No questions were asked in the debate.

## Overruled

- none

## Cost of this debate

- 2 of 2 rounds, about 148k tokens
