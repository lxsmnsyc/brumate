---
goal: Make every context static and carry live values through a store contract and $store, moving the ui parts' live context values to stores first
date: 2026-11-03
rounds: 2 of 3
status: proposed
roadmap: docs/roadmaps/brumate (story context-stores)
supersedes: none
decision: docs/decisions.md (to write when the story lands)
---

# Debate: static contexts, live values through stores

The maintainer chose the direction (Q1): every context is static, whatever its value, and live values come from a store put into the context. This replaces static-contexts, whose proof of which contexts can change (#448) found two miscompiles and saved 897 B gzip across the website (J3). After two rounds the maintainer set the story's purpose (Q3): one clear rule, not size. Contexts are static, live data is an explicit store, and a reader knows which is which.

## Settled structure

1. **A capped spike first** (Q3, O8, O9). Build `brumate/store` and `$store` far enough to compile one provider with 42 readers both ways (today's live context, and a store per provider), and test the four resume holes. Gates:
   - the four resume cases pass: a handler field crosses as a function reference, one store keeps one identity across a streamed `#loading` chunk, a module-level store changed since the server render is repaired on resume, and a reader that resumes after a `set` reads the current value;
   - the diamond cases of ordered-updates pass with a provider store derived from props and memos (O10);
   - the gzip of the fixture both ways is recorded. Size is reported, not a gate (Q3).
2. **The store** (P9, P11, O7): one store per provider, not per field. 142 readers in packages/ui need 142 cells, or 42 for a month grid, today's grain; per-field stores would need 422, or about 1050 (P10, O4). `brumate/store` exports a `Store` with `get`, `subscribe` and `set`; `$store(ctx)` reads one. A seroval plugin sends only the value; the browser builds a new store and each reader subscribes when its scope resumes and reads `get()` then (P11, O9). A foreign store inside a context is refused on the server, with an error that names the context; at module level it works.
3. **Ordered updates** (P13, O10): a provider's store derives through a compiled update part in the binding stage, where `updateContext` sits today, and notifies through the queued context send, so props and the store value reach a reader in one pass. A user or foreign store writes through the same queued send.
4. **Static contexts** (P12, P16): a context value is read once. 77 of the 192 `$setContext` calls hold no reactive name and compile static with no change. One-level parent-to-child contexts can become props. The compiler warns when a local `$signal`, `$memo` or `let` is read in a `$setContext` argument; `$untrack` silences it. 21 calls read only a prop and stay silent: accepted (O12). Devtools label each context static or store, and development logs once when a static value changes.
5. **Functions in a context** (P14): only for handlers, effects and `$client`. The 24 calls that hold functions all hold handlers. What a reader renders comes from the store.
6. **`$route` and `$navigation` stay runtime contexts** (O11): moving them to stores adds code to every app that uses them, for no gain.
7. **Order after the spike** (P8, P5): `store()` and `$store`; then the ui parts in three waves (field and form; calendar, date and color; collection, menu and combobox), while the live path still exists; then a small node that deletes the live path (graph.ts:624, analyze.ts:2366, `updateContext`, J8). store-lens-spike is not needed for this and stays optional.

## Budget

- device (client bytes): no size goal (Q3). Live contexts that become stores ship about the same update code plus the Store class, the plugin (about 170 B gzip, estimated) and a subscription per reader (O8); the 77 constant contexts drop their update parts. The spike records the fixture both ways.
- time: one spike, then about five nodes in 0.7.0 (P5).
- tokens: unmeasured; about 115 call sites across about 60 files for the waves (P3).

## Rejected

- A compile error for a reactive read in a `$setContext` value (P2): it cannot tell a live value from a constant without whole-program analysis (O3).
- Context functions that read signals at call time in a reader's render (P4): they go stale silently (O6).
- A store per field (P1, P10): 422 cells in packages/ui against 142 (O4).
- Signals or getters in a static context (P7): brumate signals are compiled slots, not runtime values (Q2).
- `$route` and `$navigation` as stores (P15): cost with no gain (O11).

## Prior art

- Solid, Svelte 5 and Vue keep the context value static and put reactive values inside it; React re-renders readers when the value's identity changes (J6).
- Marko 6 has no context API: prop drilling, or the request-scoped `$global`, not reactive and serialized per opted-in key (J9).

## Open risks

- Size of a live context as a store (O8): measured by the spike, reported, not a gate.
- The four resume holes (O9): gates of the spike.
- Stores written by user code or other libraries outside the ordered pass (O10): a gate of the spike.

## Inferred choices

- 0.x breaks are minor bumps with no deprecation; the story is in 0.7.0 (J7).

## Answers from the user

- Q1: keep every context static, regardless of the value; the future `$store` API provides live values. "There is no `$store`" in decisions.md was a state note.
- Q2: signals cannot go into a context; brumate has no signal runtime like Solid and Svelte.
- Q3: the story is for one clear rule; start with a capped spike, and the ui waves follow only if it passes.

## Overruled

- None.

## Cost of this debate

- 2 of 3 rounds, about 245k tokens.
