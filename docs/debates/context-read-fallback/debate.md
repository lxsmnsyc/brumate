---
goal: Replace the $hasContext guard with a fallback at the read, $getContext(C, fallback) as Qwik and Vue have it, so an optional context read is one call and one lookup, with $store taking a store only
date: 2026-11-06
rounds: 1 of 1 (short: the user picked the design from four)
status: approved
roadmap: docs/roadmaps/brumate
supersedes: docs/debates/context-api/debate.md
decision: none yet (the node updates the context entries of docs/decisions.md)
---

# Debate: a fallback at the context read

The user asked for a redesign because `$hasContext` and `$getContext` are two lookups (J2), and picked design A of four (J1).

## Settled structure

- `$getContext(C)` throws without a provider, as today. `$getContext(C, fallback)` returns the provided value, or `fallback` when no provider is above. The argument count decides, as in Vue, so `$getContext(C, undefined)` is the optional read. A provided `undefined` is a value. (P1)
- The fallback is lazy: a non-literal fallback compiles to a function that the runtime calls only when the walk finds no provider, in the reader's scope, once per read; a literal is passed as it is. Nothing is stored on the context, so nothing is shared across requests. (P2)
- One walk per read: the compiled read becomes `consume(C, scope, fallback)` on the server and in the browser; `has()` and `hasContext()` are deleted. (P3)
- `$hasContext` is removed. Its 2 standalone uses become `$getContext(ToolbarContext, false)`. (P4)
- `$store` takes a store only. An optional store: `const g = $getContext(C, undefined); const s = g ? $store(g.state) : undefined;`. The compiler accepts that form and reports others as BRM197. (P5)
- Work: node store-only-source becomes context-read-fallback (L), core plus a scripted ui rewrite; the ui part splits into its own M node only if the diff passes 60 files. store-bridge waits on it. (P6)

## Budget

- device: one walk per read instead of two; `has` removed on both sides (P3).
- time: one L node before store-bridge (P6).
- tokens: one worker run and a fresh review, as ui-store-guards plus a core change (P6).
- api: one read form, the shape of Qwik v2 and Vue (J3).

## Rejected

- Keeping `$hasContext` as a boolean only: no reader needs presence without the value (O4, J4).
- Designs B, C and D: the user picked A (J1).

## Prior art

- Qwik v2 `useContext(ctx, default)`, Vue `inject(key, default)`, Angular `inject(T, { optional: true })`: one call, no default in module scope (J3).

## Open risks

- A fallback that is not a literal runs again in the browser on resume, as a `$store` source does, so a fallback that makes a new object gives the browser a different object (O1): accepted, documented next to the store sources, and pinned by a test.
- The 66 guarded `$store(C)` reads grow to two lines (O2): accepted, `$store` takes a store only (J5).
- A context whose provided value may be `undefined` cannot be tested by a fallback (O3): accepted, no such reader exists.

## Inferred choices

- Breaking change, minor bump, no deprecation; the forms are unreleased, so the story's changesets are edited (J5).

## Answers from the user

- Pick among four designs: A, a fallback at the read.
- Approved 2026-11-06 after seeing the optional store examples. A fallback can itself be a store, `$store($getContext(LocaleContext, store(DEFAULT_LOCALE)))`: a per-reader constant store, made only without a provider, so no guard is needed when a constant default exists. Readers with no constant default use the guard on the value.

## Overruled

- none

## Cost of this debate

- 1 of 1 rounds, about 15k tokens
